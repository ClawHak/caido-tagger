import type { Caido } from "@caido/sdk-frontend";
import type { API } from "caido-tagger-backend";
import { getState, setState, subscribe } from "../state";
import type { Tag, Severity } from "../state";
import { createTagModal } from "../components/TagModal";
import { exportTags, importTags } from "../components/ImportExport";
import {
  createTag,
  updateTag,
  deleteTag,
  loadTags,
  setProjectOverride,
  removeProjectOverride,
} from "../api";

type SDK = Caido<API>;

const SEVERITIES: Severity[] = ["info", "low", "medium", "high", "critical"];

export function createTagConfigPage(sdk: SDK): HTMLElement {
  const root = document.createElement("div");
  root.className = "ct-tab-content";

  const render = () => {
    root.innerHTML = "";
    root.appendChild(buildTagConfigContent(sdk));
  };

  const unsubscribe = subscribe(render);
  root.addEventListener("ct:destroy", () => unsubscribe());

  render();
  return root;
}

function buildTagConfigContent(sdk: SDK): HTMLElement {
  const { tags, overrides, projectId, projectName } = getState();

  const wrap = document.createElement("div");

  // Header
  const header = document.createElement("div");
  header.className = "ct-section-header";
  header.innerHTML = `
    <div class="ct-section-header__info">
      <span class="ct-muted">Project:</span>
      <strong>${projectName ?? "—"}</strong>
    </div>
    <div class="ct-section-header__actions">
      <button class="ct-btn ct-btn--secondary" id="ct-import-btn">Import</button>
      <button class="ct-btn ct-btn--secondary" id="ct-export-btn">Export</button>
    </div>
  `;
  wrap.appendChild(header);

  // Global tags table
  const globalSection = document.createElement("div");
  globalSection.className = "ct-section";
  globalSection.innerHTML = `
    <div class="ct-section__title">
      <h4>Global Tags</h4>
      <button class="ct-btn ct-btn--primary ct-btn--sm" id="ct-new-tag-btn">+ New Tag</button>
    </div>
  `;

  const globalTable = buildTagsTable(sdk, tags, false);
  globalSection.appendChild(globalTable);
  wrap.appendChild(globalSection);

  // Project overrides section
  if (projectId) {
    const overrideTags = tags.filter((t) => overrides[t.id] !== undefined);

    const overrideSection = document.createElement("div");
    overrideSection.className = "ct-section ct-section--overrides";
    overrideSection.innerHTML = `
      <div class="ct-section__title">
        <h4>Project Overrides <span class="ct-muted">(${projectName ?? "current project"})</span></h4>
      </div>
      <p class="ct-hint">Only tags that differ from their global severity appear here.</p>
    `;

    overrideSection.appendChild(buildOverridesTable(sdk, tags, overrides, projectId));
    wrap.appendChild(overrideSection);
  }

  // Event handlers
  wrap.querySelector("#ct-new-tag-btn")?.addEventListener("click", () => {
    const modal = createTagModal({
      onSave: async (data) => {
        await createTag(sdk, {
          name: data.name,
          color: data.color,
          severity: data.severity as Severity || undefined,
          description: data.description,
          scope: data.scope,
          project_id: data.scope === "project" ? (projectId ?? undefined) : undefined,
        });
        if (projectId) await loadTags(sdk, projectId);
      },
      onCancel: () => {},
    });
    document.body.appendChild(modal);
  });

  wrap.querySelector("#ct-export-btn")?.addEventListener("click", () => {
    exportTags(tags);
  });

  wrap.querySelector("#ct-import-btn")?.addEventListener("click", () => {
    importTags(
      async (imported) => {
        for (const t of imported) {
          await createTag(sdk, {
            name: t.name,
            color: t.color,
            severity: (t.severity as Severity) || undefined,
            description: t.description,
            scope: "global",
          });
        }
        if (projectId) await loadTags(sdk, projectId);
        sdk.window.showToast(`Imported ${imported.length} tags`, { variant: "success" });
      },
      (err) => sdk.window.showToast(err, { variant: "error" })
    );
  });

  return wrap;
}

function buildTagsTable(sdk: SDK, tags: Tag[], _isOverride: boolean): HTMLElement {
  const { projectId } = getState();

  if (tags.length === 0) {
    const empty = document.createElement("p");
    empty.className = "ct-muted ct-empty";
      empty.textContent = "No tags yet. Click + New Tag to create one.";
    return empty;
  }

  const table = document.createElement("table");
  table.className = "ct-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width:40px">Color</th>
        <th>Name</th>
        <th>Severity</th>
        <th>Description</th>
        <th style="width:80px"></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody")!;

  tags.forEach((tag) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="ct-color-dot" style="background:${tag.color}"></span></td>
      <td><strong>${tag.name}</strong></td>
      <td>${tag.severity ? `<span class="ct-severity ct-severity--${tag.severity}">${tag.severity}</span>` : "<span class='ct-muted'>—</span>"}</td>
      <td class="ct-muted">${tag.description || "—"}</td>
      <td class="ct-actions">
        <button class="ct-btn-icon" data-action="edit" data-id="${tag.id}" title="Edit">✏</button>
        <button class="ct-btn-icon ct-btn-icon--danger" data-action="delete" data-id="${tag.id}" title="Delete">🗑</button>
      </td>
    `;

    tr.querySelector("[data-action='edit']")?.addEventListener("click", () => {
      const modal = createTagModal({
        tag,
        onSave: async (data) => {
          await updateTag(sdk, tag.id, {
            name: data.name,
            color: data.color,
            severity: (data.severity as Severity) || undefined,
            description: data.description,
          });
          if (projectId) await loadTags(sdk, projectId);
        },
        onCancel: () => {},
      });
      document.body.appendChild(modal);
    });

    tr.querySelector("[data-action='delete']")?.addEventListener("click", async () => {
      if (!confirm(`Delete tag "${tag.name}"? This will remove it from all requests.`)) return;
      await deleteTag(sdk, tag.id);
      if (projectId) await loadTags(sdk, projectId);
    });

    tbody.appendChild(tr);
  });

  return table;
}

function buildOverridesTable(
  sdk: SDK,
  tags: Tag[],
  overrides: Record<string, Severity>,
  projectId: string
): HTMLElement {
  const table = document.createElement("table");
  table.className = "ct-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width:40px">Color</th>
        <th>Name</th>
        <th>Global Severity</th>
        <th>Project Override</th>
        <th style="width:40px"></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody")!;

  tags.forEach((tag) => {
    const tr = document.createElement("tr");
    const currentOverride = overrides[tag.id] ?? tag.severity ?? "";

    tr.innerHTML = `
      <td><span class="ct-color-dot" style="background:${tag.color}"></span></td>
      <td><strong>${tag.name}</strong></td>
      <td>${tag.severity ? `<span class="ct-severity ct-severity--${tag.severity}">${tag.severity}</span>` : "<span class='ct-muted'>—</span>"}</td>
      <td>
        <select class="ct-select ct-select--sm ct-override-select" data-tag-id="${tag.id}">
          <option value="">— none —</option>
          ${SEVERITIES.map(
            (s) => `<option value="${s}" ${currentOverride === s ? "selected" : ""}>${s}</option>`
          ).join("")}
        </select>
      </td>
      <td>
        ${overrides[tag.id] ? `<button class="ct-btn-icon ct-btn-icon--danger" data-action="clear-override" data-tag-id="${tag.id}" title="Remove override">×</button>` : ""}
      </td>
    `;

    tr.querySelector(".ct-override-select")?.addEventListener("change", async (e) => {
      const val = (e.target as HTMLSelectElement).value as Severity;
      if (val) {
        await setProjectOverride(sdk, tag.id, projectId, val);
      } else {
        await removeProjectOverride(sdk, tag.id, projectId);
      }
      await loadTags(sdk, projectId);
    });

    tr.querySelector("[data-action='clear-override']")?.addEventListener("click", async () => {
      await removeProjectOverride(sdk, tag.id, projectId);
      await loadTags(sdk, projectId);
    });

    tbody.appendChild(tr);
  });

  // Add all tags to override table (not just ones with overrides)
  if (tbody.children.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="ct-muted ct-empty">No overrides set. Use the dropdowns above to override severity per project.</td>`;
    tbody.appendChild(tr);
  }

  return table;
}
