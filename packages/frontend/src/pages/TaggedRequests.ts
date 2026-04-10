import type { Caido } from "@caido/sdk-frontend";
import type { API } from "caido-tagger-backend";
import { getState, setState, subscribe, filteredRequests, effectiveTags } from "../state";
import type { TaggedRequestRow } from "../state";
import { createTagPillsContainer } from "../components/TagPill";
import { loadTaggedRequests, sendToReplay, sendToAutomate } from "../api";
import { getRegisteredActions } from "../registry";

type SDK = Caido<API>;

export function createTaggedRequestsPage(sdk: SDK): HTMLElement {
  const root = document.createElement("div");
  root.className = "ct-tab-content ct-tagged-split";

  // Upper half: toolbar + table (re-renders on state change)
  const upper = document.createElement("div");
  upper.className = "ct-tagged-upper";

  // Lower half: request/response editors (built lazily on first row click)
  const lower = document.createElement("div");
  lower.className = "ct-tagged-lower";
  lower.hidden = true;

  // Detail panel scaffold (always present, editors mounted lazily)
  const detailHeader = document.createElement("div");
  detailHeader.className = "ct-detail-header";
  const detailTitle = document.createElement("span");
  detailTitle.className = "ct-detail-title";
  const closeBtn = document.createElement("button");
  closeBtn.className = "ct-btn-icon";
  closeBtn.textContent = "×";
  closeBtn.title = "Close detail";
  detailHeader.appendChild(detailTitle);
  detailHeader.appendChild(closeBtn);

  const reqWrap = document.createElement("div");
  reqWrap.className = "ct-detail-editor";
  const resWrap = document.createElement("div");
  resWrap.className = "ct-detail-editor";

  const reqPane = document.createElement("div");
  reqPane.className = "ct-detail-pane";
  const reqLabel = document.createElement("div");
  reqLabel.className = "ct-detail-label";
  reqLabel.textContent = "Request";
  reqPane.appendChild(reqLabel);
  reqPane.appendChild(reqWrap);

  const resPane = document.createElement("div");
  resPane.className = "ct-detail-pane";
  const resLabel = document.createElement("div");
  resLabel.className = "ct-detail-label";
  resLabel.textContent = "Response";
  resPane.appendChild(resLabel);
  resPane.appendChild(resWrap);

  const editorRow = document.createElement("div");
  editorRow.className = "ct-detail-editors";
  editorRow.appendChild(reqPane);
  editorRow.appendChild(resPane);

  lower.appendChild(detailHeader);
  lower.appendChild(editorRow);

  // Editors created lazily on first use — avoids crashing init if API unavailable
  let reqEditor: ReturnType<typeof sdk.ui.httpRequestEditor> | null = null;
  let resEditor: ReturnType<typeof sdk.ui.httpResponseEditor> | null = null;

  const ensureEditors = (): boolean => {
    if (reqEditor && resEditor) return true;
    try {
      reqEditor = sdk.ui.httpRequestEditor();
      resEditor = sdk.ui.httpResponseEditor();
      reqWrap.appendChild(reqEditor.getElement());
      resWrap.appendChild(resEditor.getElement());
      return true;
    } catch (err) {
      console.error("[caido-tagger] Failed to create editors:", err);
      return false;
    }
  };

  const setEditorText = (
    editor: ReturnType<typeof sdk.ui.httpRequestEditor> | ReturnType<typeof sdk.ui.httpResponseEditor>,
    text: string
  ) => {
    try {
      const view = (editor as any).getEditorView();
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    } catch {
      // ignore
    }
  };

  let activeId: string | null = null;

  const loadDetail = async (requestId: string, shortId: string) => {
    if (!ensureEditors()) return;
    detailTitle.textContent = `…${shortId}`;
    setEditorText(reqEditor!, "Loading…");
    setEditorText(resEditor!, "");
    try {
      const res = await sdk.graphql.request({ id: requestId });
      const req = res.request;
      if (!req) {
        setEditorText(reqEditor!, "(request not found)");
        return;
      }
      setEditorText(reqEditor!, req.raw);
      if (req.response?.id) {
        const resData = await sdk.graphql.response({ id: req.response.id });
        setEditorText(resEditor!, resData.response?.raw ?? "(empty response)");
      } else {
        setEditorText(resEditor!, "(no response)");
      }
    } catch (err) {
      setEditorText(reqEditor!, `Error: ${err}`);
    }
  };

  const onRowClick = (requestId: string, shortId: string) => {
    if (activeId === requestId) {
      // Toggle off
      activeId = null;
      lower.hidden = true;
      render();
      return;
    }
    activeId = requestId;
    lower.hidden = false;
    loadDetail(requestId, shortId);
    render(); // update active row highlight
  };

  closeBtn.addEventListener("click", () => {
    activeId = null;
    lower.hidden = true;
    render();
  });

  const render = () => {
    upper.innerHTML = "";
    upper.appendChild(buildUpperContent(sdk, onRowClick, activeId));
  };

  const unsubscribe = subscribe(render);
  root.addEventListener("ct:destroy", () => unsubscribe());

  render();
  root.appendChild(upper);
  root.appendChild(lower);
  return root;
}

function buildUpperContent(
  sdk: SDK,
  onRowClick: (requestId: string, shortId: string) => void,
  activeId: string | null
): HTMLElement {
  const { tags, selectedIds, loading, projectId } = getState();
  const rows = filteredRequests();

  const wrap = document.createElement("div");
  wrap.className = "ct-tagged-wrap";

  // Toolbar
  wrap.appendChild(buildToolbar(sdk));

  if (loading) {
    const loader = document.createElement("div");
    loader.className = "ct-placeholder";
    loader.textContent = "Loading...";
    wrap.appendChild(loader);
    return wrap;
  }

  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "ct-placeholder";
    empty.innerHTML = `
      <p>No tagged requests found.</p>
      <p>Right-click any request in <strong>HTTP History</strong> and select <strong>Tag Request</strong>.</p>
    `;
    wrap.appendChild(empty);
    return wrap;
  }

  // Bulk action bar
  if (selectedIds.size > 0) {
    wrap.appendChild(buildBulkActions(sdk));
  }

  // Table
  const tableWrap = document.createElement("div");
  tableWrap.className = "ct-table-wrap";

  const table = document.createElement("table");
  table.className = "ct-table ct-table--requests";

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.request_id));

  table.innerHTML = `
    <colgroup>
      <col style="width:36px">
      <col style="width:80px">
      <col style="width:18%">
      <col style="width:72px">
      <col>
      <col style="width:62px">
      <col style="width:22%">
    </colgroup>
    <thead>
      <tr>
        <th>
          <input type="checkbox" class="ct-checkbox" id="ct-select-all" ${allSelected ? "checked" : ""} title="Select all" />
        </th>
        <th>ID</th>
        <th>Host</th>
        <th>Method</th>
        <th>Path & Query</th>
        <th>Status</th>
        <th>Tags</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  table.querySelector("#ct-select-all")?.addEventListener("change", (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    setState((s) => {
      const next = new Set(s.selectedIds);
      rows.forEach((r) => {
        if (checked) next.add(r.request_id);
        else next.delete(r.request_id);
      });
      return { selectedIds: next };
    });
  });

  const tbody = table.querySelector("tbody")!;
  rows.forEach((row) => {
    tbody.appendChild(buildRequestRow(sdk, row, onRowClick, activeId));
  });

  tableWrap.appendChild(table);
  wrap.appendChild(tableWrap);

  return wrap;
}

function buildToolbar(sdk: SDK): HTMLElement {
  const { filterTagIds, filterSeverity, filterSearch, projectId } = getState();
  const visibleTags = effectiveTags();

  const toolbar = document.createElement("div");
  toolbar.className = "ct-toolbar";

  // Tag filter
  const tagSelect = document.createElement("select");
  tagSelect.className = "ct-select";
  tagSelect.innerHTML = `<option value="">All Tags</option>` +
    visibleTags.map((t) => `<option value="${t.id}" ${filterTagIds.includes(t.id) ? "selected" : ""}>${t.name}</option>`).join("");

  tagSelect.addEventListener("change", () => {
    const val = tagSelect.value;
    setState(() => ({ filterTagIds: val ? [val] : [], selectedIds: new Set() }));
  });

  // Severity filter
  const sevSelect = document.createElement("select");
  sevSelect.className = "ct-select";
  sevSelect.innerHTML = `
    <option value="">All Severity</option>
    <option value="info" ${filterSeverity === "info" ? "selected" : ""}>Info</option>
    <option value="low" ${filterSeverity === "low" ? "selected" : ""}>Low</option>
    <option value="medium" ${filterSeverity === "medium" ? "selected" : ""}>Medium</option>
    <option value="high" ${filterSeverity === "high" ? "selected" : ""}>High</option>
    <option value="critical" ${filterSeverity === "critical" ? "selected" : ""}>Critical</option>
  `;
  sevSelect.addEventListener("change", () => {
    setState(() => ({ filterSeverity: sevSelect.value, selectedIds: new Set() }));
  });

  // Search
  const search = document.createElement("input");
  search.className = "ct-input ct-input--search";
  search.type = "text";
  search.placeholder = "Search host / path...";
  search.value = filterSearch;
  search.addEventListener("input", () => {
    setState(() => ({ filterSearch: search.value, selectedIds: new Set() }));
  });

  // Refresh button
  const refreshBtn = document.createElement("button");
  refreshBtn.className = "ct-btn ct-btn--secondary ct-btn--sm";
  refreshBtn.textContent = "↻ Refresh";
  refreshBtn.addEventListener("click", () => {
    if (projectId) loadTaggedRequests(sdk, projectId);
  });

  toolbar.appendChild(tagSelect);
  toolbar.appendChild(sevSelect);
  toolbar.appendChild(search);
  toolbar.appendChild(refreshBtn);

  return toolbar;
}

function buildBulkActions(sdk: SDK): HTMLElement {
  const { selectedIds, projectId } = getState();
  const count = selectedIds.size;

  const bar = document.createElement("div");
  bar.className = "ct-bulk-bar";

  const label = document.createElement("span");
  label.className = "ct-bulk-bar__label";
  label.textContent = `${count} selected`;

  const replayBtn = document.createElement("button");
  replayBtn.className = "ct-btn ct-btn--secondary ct-btn--sm";
  replayBtn.textContent = "Send to Replay";
  replayBtn.addEventListener("click", async () => {
    const ids = [...selectedIds];
    let ok = 0;
    for (const id of ids) {
      try {
        await sendToReplay(sdk, id);
        ok++;
      } catch {
        // continue
      }
    }
    sdk.window.showToast(`Sent ${ok}/${ids.length} to Replay`, { variant: "success" });
  });

  const automateBtn = document.createElement("button");
  automateBtn.className = "ct-btn ct-btn--secondary ct-btn--sm";
  automateBtn.textContent = "Send to Automate";
  automateBtn.addEventListener("click", async () => {
    const ids = [...selectedIds];
    let ok = 0;
    for (const id of ids) {
      try {
        await sendToAutomate(sdk, id);
        ok++;
      } catch {
        // continue
      }
    }
    sdk.window.showToast(`Sent ${ok}/${ids.length} to Automate`, { variant: "success" });
  });

  const deselectBtn = document.createElement("button");
  deselectBtn.className = "ct-btn ct-btn--secondary ct-btn--sm";
  deselectBtn.textContent = "Deselect";
  deselectBtn.addEventListener("click", () => {
    setState(() => ({ selectedIds: new Set() }));
  });

  bar.appendChild(label);
  bar.appendChild(replayBtn);
  bar.appendChild(automateBtn);

  // Plugin Actions dropdown — populated from window.__caidoTagger registry
  const pluginActions = getRegisteredActions();
  if (pluginActions.length > 0) {
    const select = document.createElement("select");
    select.className = "ct-select ct-select--sm";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Plugin Actions…";
    select.appendChild(placeholder);

    pluginActions.forEach((action) => {
      const opt = document.createElement("option");
      opt.value = action.id;
      opt.textContent = action.label;
      select.appendChild(opt);
    });

    select.addEventListener("change", async () => {
      const id = select.value;
      if (!id) return;
      const action = pluginActions.find((a) => a.id === id);
      if (action) {
        await action.handler([...selectedIds]);
        sdk.window.showToast(`"${action.label}" executed`, { variant: "success" });
      }
      select.value = "";
    });

    bar.appendChild(select);
  }

  bar.appendChild(deselectBtn);

  return bar;
}

function buildRequestRow(
  sdk: SDK,
  row: TaggedRequestRow,
  onRowClick: (requestId: string, shortId: string) => void,
  activeId: string | null
): HTMLElement {
  const { selectedIds, tags } = getState();
  const rowTags = tags.filter((t) => row.tag_ids.includes(t.id));
  const isSelected = selectedIds.has(row.request_id);
  const isActive = row.request_id === activeId;

  const tr = document.createElement("tr");
  tr.className = [
    "ct-row",
    isSelected ? "ct-row--selected" : "",
    isActive ? "ct-row--active" : "",
  ].filter(Boolean).join(" ");
  tr.dataset["id"] = row.request_id;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "ct-checkbox";
  checkbox.checked = isSelected;
  checkbox.addEventListener("change", (e) => {
    e.stopPropagation(); // don't trigger row click
    setState((s) => {
      const next = new Set(s.selectedIds);
      if (checkbox.checked) next.add(row.request_id);
      else next.delete(row.request_id);
      return { selectedIds: next };
    });
  });

  const method = row.meta?.method ?? "—";
  const host = row.meta?.host ?? "—";
  const path = row.meta?.path ?? "";
  const query = row.meta?.query ? `?${row.meta.query}` : "";
  const status = row.meta?.status ?? 0;
  const shortId = row.request_id.slice(-8);

  // Status color
  const statusClass =
    status >= 500 ? "ct-status--5xx" :
    status >= 400 ? "ct-status--4xx" :
    status >= 300 ? "ct-status--3xx" :
    status >= 200 ? "ct-status--2xx" : "ct-status--none";

  const tdCheck = document.createElement("td");
  tdCheck.appendChild(checkbox);

  const tdId = document.createElement("td");
  tdId.className = "ct-cell--id ct-muted";
  tdId.textContent = shortId;
  tdId.title = row.request_id;

  const tdHost = document.createElement("td");
  tdHost.className = "ct-cell--host";
  tdHost.textContent = host;

  const tdMethod = document.createElement("td");
  tdMethod.innerHTML = `<span class="ct-method ct-method--${method.toLowerCase()}">${method}</span>`;

  const tdPath = document.createElement("td");
  tdPath.className = "ct-cell--path";
  tdPath.textContent = `${path}${query}`;
  tdPath.title = `${path}${query}`;

  const tdStatus = document.createElement("td");
  tdStatus.innerHTML = status
    ? `<span class="ct-status ${statusClass}">${status}</span>`
    : `<span class="ct-muted">—</span>`;

  const tdTags = document.createElement("td");
  tdTags.appendChild(createTagPillsContainer(rowTags));

  tr.appendChild(tdCheck);
  tr.appendChild(tdId);
  tr.appendChild(tdHost);
  tr.appendChild(tdMethod);
  tr.appendChild(tdPath);
  tr.appendChild(tdStatus);
  tr.appendChild(tdTags);

  // Click on the row (not the checkbox) opens the detail panel
  tr.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("input[type=checkbox]")) return;
    onRowClick(row.request_id, shortId);
  });

  return tr;
}
