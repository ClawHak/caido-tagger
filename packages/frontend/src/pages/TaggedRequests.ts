import type { Caido } from "@caido/sdk-frontend";
import type { API } from "caido-tagger-backend";
import { getState, setState, subscribe, filteredRequests } from "../state";
import type { TaggedRequestRow } from "../state";
import { createTagPillsContainer } from "../components/TagPill";
import { loadTaggedRequests, sendToReplay, sendToAutomate } from "../api";
import { getRegisteredActions } from "../registry";

type SDK = Caido<API>;

export function createTaggedRequestsPage(sdk: SDK): HTMLElement {
  const root = document.createElement("div");
  root.className = "ct-tab-content";

  const render = () => {
    root.innerHTML = "";
    root.appendChild(buildTaggedRequestsContent(sdk));
  };

  const unsubscribe = subscribe(render);
  root.addEventListener("ct:destroy", () => unsubscribe());

  render();
  return root;
}

function buildTaggedRequestsContent(sdk: SDK): HTMLElement {
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
    <thead>
      <tr>
        <th style="width:32px">
          <input type="checkbox" class="ct-checkbox" id="ct-select-all" ${allSelected ? "checked" : ""} title="Select all" />
        </th>
        <th style="width:60px">Method</th>
        <th>Host</th>
        <th>Path</th>
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
    tbody.appendChild(buildRequestRow(sdk, row, tags));
  });

  tableWrap.appendChild(table);
  wrap.appendChild(tableWrap);

  // Detail sidebar (shows when a single row is clicked)
  return wrap;
}

function buildToolbar(sdk: SDK): HTMLElement {
  const { tags, filterTagIds, filterSeverity, filterSearch, projectId } = getState();

  const toolbar = document.createElement("div");
  toolbar.className = "ct-toolbar";

  // Tag filter
  const tagSelect = document.createElement("select");
  tagSelect.className = "ct-select";
  tagSelect.innerHTML = `<option value="">All Tags</option>` +
    tags.map((t) => `<option value="${t.id}" ${filterTagIds.includes(t.id) ? "selected" : ""}>${t.name}</option>`).join("");

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

function buildRequestRow(sdk: SDK, row: TaggedRequestRow, allTags: typeof getState extends () => infer T ? T["tags"] : never[]): HTMLElement {
  const { selectedIds, tags } = getState();
  const rowTags = tags.filter((t) => row.tag_ids.includes(t.id));
  const isSelected = selectedIds.has(row.request_id);

  const tr = document.createElement("tr");
  tr.className = isSelected ? "ct-row ct-row--selected" : "ct-row";
  tr.dataset["id"] = row.request_id;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "ct-checkbox";
  checkbox.checked = isSelected;
  checkbox.addEventListener("change", () => {
    setState((s) => {
      const next = new Set(s.selectedIds);
      if (checkbox.checked) next.add(row.request_id);
      else next.delete(row.request_id);
      return { selectedIds: next };
    });
  });

  const method = row.meta?.method ?? "—";
  const host = row.meta?.host ?? row.request_id;
  const path = row.meta?.path ?? "";
  const query = row.meta?.query ? `?${row.meta.query}` : "";

  const tdCheck = document.createElement("td");
  tdCheck.appendChild(checkbox);

  const tdMethod = document.createElement("td");
  tdMethod.innerHTML = `<span class="ct-method ct-method--${method.toLowerCase()}">${method}</span>`;

  const tdHost = document.createElement("td");
  tdHost.className = "ct-cell--host";
  tdHost.textContent = host;

  const tdPath = document.createElement("td");
  tdPath.className = "ct-cell--path";
  tdPath.textContent = `${path}${query}`;
  tdPath.title = `${path}${query}`;

  const tdTags = document.createElement("td");
  tdTags.appendChild(createTagPillsContainer(rowTags));

  tr.appendChild(tdCheck);
  tr.appendChild(tdMethod);
  tr.appendChild(tdHost);
  tr.appendChild(tdPath);
  tr.appendChild(tdTags);

  return tr;
}
