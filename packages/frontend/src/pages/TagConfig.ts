import type { Caido } from "@caido/sdk-frontend";
import type { API } from "caido-tagger-backend";
import { getState, setState, subscribe } from "../state";
import type { Tag, Severity } from "../state";
import type { TagScope } from "caido-tagger-backend";
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

  const globalTags = tags.filter((t) => t.scope === "global");
  const projectTags = tags.filter((t) => t.scope === "project");

  // Names of project tags — used to mark overridden global tags
  const projectTagNames = new Set(projectTags.map((t) => t.name));

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

  // Global tags section
  const globalSection = document.createElement("div");
  globalSection.className = "ct-section";
  globalSection.innerHTML = `
    <div class="ct-section__title">
      <h4>Global Tags</h4>
      <button class="ct-btn ct-btn--primary ct-btn--sm" id="ct-new-global-btn">+ New Tag</button>
    </div>
  `;
  globalSection.appendChild(buildTagsTable(sdk, globalTags, "global", projectTagNames));
  wrap.appendChild(globalSection);

  // Project tags section (only when in a project)
  if (projectId) {
    const projectSection = document.createElement("div");
    projectSection.className = "ct-section";
    projectSection.innerHTML = `
      <div class="ct-section__title">
        <h4>Project Tags <span class="ct-muted">(${projectName ?? "this project"})</span></h4>
        <button class="ct-btn ct-btn--primary ct-btn--sm" id="ct-new-project-btn">+ New Tag</button>
      </div>
      <p class="ct-hint">Project tags override global tags with the same name.</p>
    `;
    projectSection.appendChild(buildTagsTable(sdk, projectTags, "project", new Set()));
    wrap.appendChild(projectSection);

    // Project overrides section
    const overrideSection = document.createElement("div");
    overrideSection.className = "ct-section ct-section--overrides";
    overrideSection.innerHTML = `
      <div class="ct-section__title">
        <h4>Severity Overrides <span class="ct-muted">(${projectName ?? "this project"})</span></h4>
      </div>
      <p class="ct-hint">Override the severity of global tags for this project only.</p>
    `;
    overrideSection.appendChild(buildOverridesTable(sdk, globalTags, projectTags, overrides, projectId));
    wrap.appendChild(overrideSection);

    wrap.querySelector("#ct-new-project-btn")?.addEventListener("click", () => {
      openTagModal(sdk, projectId, "project");
    });
  }

  // New Global Tag button
  wrap.querySelector("#ct-new-global-btn")?.addEventListener("click", () => {
    openTagModal(sdk, projectId, "global");
  });

  wrap.querySelector("#ct-export-btn")?.addEventListener("click", () => {
    exportTags(tags);
  });

  wrap.querySelector("#ct-import-btn")?.addEventListener("click", () => {
    importTags(
      async (imported) => {
        const existing = getState().tags;
        let created = 0, skipped = 0;
        for (const t of imported) {
          const scope = t.scope ?? "global";
          const project_id = scope === "project" ? (projectId ?? "") : "";
          const exists = existing.some(
            (e) => e.name === t.name && e.scope === scope &&
              (scope === "global" || e.project_id === project_id)
          );
          if (exists) {
            skipped++;
          } else {
            await createTag(sdk, { name: t.name, color: t.color, severity: t.severity || "", description: t.description, scope, project_id });
            created++;
          }
        }
        await loadTags(sdk, projectId);
        const parts = [];
        if (created) parts.push(`${created} created`);
        if (skipped) parts.push(`${skipped} skipped`);
        sdk.window.showToast(`Import: ${parts.join(", ")}`, { variant: "success" });
      },
      (err) => sdk.window.showToast(err, { variant: "error" })
    );
  });

  return wrap;
}

function openTagModal(sdk: SDK, projectId: string | null, defaultScope: TagScope, tag?: Tag): void {
  const { projectId: pid } = getState();
  const modal = createTagModal({
    tag,
    onSave: async (data) => {
      if (tag) {
        await updateTag(sdk, tag.id, {
          name: data.name,
          color: data.color,
          severity: data.severity,
          description: data.description,
        });
      } else {
        await createTag(sdk, {
          name: data.name,
          color: data.color,
          severity: data.severity,
          description: data.description,
          scope: data.scope,
          project_id: data.scope === "project" ? (pid ?? "") : "",
        });
      }
      await loadTags(sdk, pid);
    },
    onCancel: () => {},
    onError: (err) => sdk.window.showToast(`Failed to save tag: ${err}`, { variant: "error" }),
    defaultScope,
  });
  document.body.appendChild(modal);
}

function buildTagsTable(sdk: SDK, tags: Tag[], scope: TagScope, overriddenNames: Set<string>): HTMLElement {
  const { projectId } = getState();

  if (tags.length === 0) {
    const empty = document.createElement("p");
    empty.className = "ct-muted ct-empty";
    empty.textContent = "No tags yet. Click + New Tag to create one.";
    return empty;
  }

  const table = document.createElement("table");
  table.className = "ct-table ct-table--tags";
  table.innerHTML = `
    <colgroup>
      <col style="width:48px">
      <col style="width:200px">
      <col style="width:160px">
      <col>
      <col style="width:72px">
    </colgroup>
    <thead>
      <tr>
        <th>Color</th>
        <th>Name</th>
        <th>Severity</th>
        <th>Description</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody")!;

  tags.forEach((tag) => {
    const isOverridden = scope === "global" && overriddenNames.has(tag.name);
    const tr = document.createElement("tr");
    if (isOverridden) tr.className = "ct-row--muted";
    tr.innerHTML = `
      <td><span class="ct-color-dot" style="background:${tag.color}"></span></td>
      <td>
        <strong>${tag.name}</strong>
        ${isOverridden ? `<span class="ct-badge ct-badge--override" title="Overridden by a project tag">project override</span>` : ""}
      </td>
      <td>${tag.severity ? `<span class="ct-severity ct-severity--${tag.severity}">${tag.severity}</span>` : "<span class='ct-muted'>—</span>"}</td>
      <td class="ct-muted">${tag.description || "—"}</td>
      <td class="ct-actions">
        <button class="ct-btn-icon" data-action="edit" data-id="${tag.id}" title="Edit">✏</button>
        <button class="ct-btn-icon ct-btn-icon--danger" data-action="delete" data-id="${tag.id}" title="Delete">🗑</button>
      </td>
    `;

    tr.querySelector("[data-action='edit']")?.addEventListener("click", () => {
      openTagModal(sdk, projectId, scope, tag);
    });

    tr.querySelector("[data-action='delete']")?.addEventListener("click", async () => {
      if (!confirm(`Delete tag "${tag.name}"? This will remove it from all requests.`)) return;
      await deleteTag(sdk, tag.id);
      await loadTags(sdk, projectId);
    });

    tbody.appendChild(tr);
  });

  return table;
}

function buildOverridesTable(
  sdk: SDK,
  tags: Tag[],
  projectTags: Tag[],
  overrides: Record<string, Severity>,
  projectId: string
): HTMLElement {
  const table = document.createElement("table");
  table.className = "ct-table ct-table--tags";
  table.innerHTML = `
    <colgroup>
      <col style="width:48px">
      <col style="width:200px">
      <col style="width:160px">
      <col>
      <col style="width:72px">
    </colgroup>
    <thead>
      <tr>
        <th>Color</th>
        <th>Name</th>
        <th>Effective Severity</th>
        <th>Project Override</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody")!;

  tags.forEach((tag) => {
    const tr = document.createElement("tr");
    // Winning order: explicit override > project tag (same name) > global tag
    const projectTag = projectTags.find((pt) => pt.name === tag.name);
    const effectiveColor = projectTag?.color ?? tag.color;
    const effectiveSeverity = overrides[tag.id] ?? projectTag?.severity ?? tag.severity ?? "";
    const currentOverride = overrides[tag.id] ?? "";

    tr.innerHTML = `
      <td><span class="ct-color-dot" style="background:${effectiveColor}"></span></td>
      <td><strong>${tag.name}</strong></td>
      <td>${effectiveSeverity ? `<span class="ct-severity ct-severity--${effectiveSeverity}">${effectiveSeverity}</span>` : "<span class='ct-muted'>—</span>"}</td>
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
