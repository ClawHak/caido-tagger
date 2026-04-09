import type { Tag } from "../state";

export type TagFormData = {
  name: string;
  color: string;
  severity: string;
  description: string;
  scope: "global" | "project";
};

type TagModalOptions = {
  tag?: Tag;
  onSave: (data: TagFormData) => void;
  onCancel: () => void;
};

const SEVERITIES = ["", "info", "low", "medium", "high", "critical"];
const PRESET_COLORS = [
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71",
  "#1abc9c", "#3498db", "#9b59b6", "#e91e63",
];

export function createTagModal(opts: TagModalOptions): HTMLElement {
  const overlay = document.createElement("div");
  overlay.className = "ct-modal-overlay";

  const modal = document.createElement("div");
  modal.className = "ct-modal";

  modal.innerHTML = `
    <div class="ct-modal__header">
      <h3>${opts.tag ? "Edit Tag" : "New Tag"}</h3>
      <button class="ct-modal__close">×</button>
    </div>
    <div class="ct-modal__body">
      <div class="ct-form-row">
        <label>Name <span class="ct-required">*</span></label>
        <input class="ct-input" id="ct-tag-name" type="text" placeholder="XSS" value="${opts.tag?.name ?? ""}" />
      </div>
      <div class="ct-form-row">
        <label>Color <span class="ct-required">*</span></label>
        <div class="ct-color-row">
          <input class="ct-input ct-input--color" id="ct-tag-color" type="color" value="${opts.tag?.color ?? "#e74c3c"}" />
          <div class="ct-color-presets">
            ${PRESET_COLORS.map(
              (c) =>
                `<button class="ct-color-preset" style="background:${c}" data-color="${c}" title="${c}"></button>`
            ).join("")}
          </div>
        </div>
      </div>
      <div class="ct-form-row">
        <label>Severity</label>
        <select class="ct-select" id="ct-tag-severity">
          ${SEVERITIES.map(
            (s) =>
              `<option value="${s}" ${opts.tag?.severity === s ? "selected" : ""}>${s || "— none —"}</option>`
          ).join("")}
        </select>
      </div>
      <div class="ct-form-row">
        <label>Description</label>
        <input class="ct-input" id="ct-tag-description" type="text" placeholder="Optional description" value="${opts.tag?.description ?? ""}" />
      </div>
      <div class="ct-form-row">
        <label>Scope</label>
        <div class="ct-radio-group">
          <label><input type="radio" name="ct-scope" value="global" ${(!opts.tag || opts.tag.scope === "global") ? "checked" : ""} /> Global</label>
          <label><input type="radio" name="ct-scope" value="project" ${opts.tag?.scope === "project" ? "checked" : ""} /> This project only</label>
        </div>
      </div>
    </div>
    <div class="ct-modal__footer">
      <button class="ct-btn ct-btn--secondary" id="ct-modal-cancel">Cancel</button>
      <button class="ct-btn ct-btn--primary" id="ct-modal-save">Save</button>
    </div>
  `;

  // Color presets
  modal.querySelectorAll(".ct-color-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const color = (btn as HTMLElement).dataset["color"]!;
      (modal.querySelector("#ct-tag-color") as HTMLInputElement).value = color;
    });
  });

  const close = () => {
    overlay.remove();
    opts.onCancel();
  };

  modal.querySelector(".ct-modal__close")!.addEventListener("click", close);
  modal.querySelector("#ct-modal-cancel")!.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  modal.querySelector("#ct-modal-save")!.addEventListener("click", () => {
    const name = (modal.querySelector("#ct-tag-name") as HTMLInputElement).value.trim();
    if (!name) {
      (modal.querySelector("#ct-tag-name") as HTMLInputElement).classList.add("ct-input--error");
      return;
    }
    const color = (modal.querySelector("#ct-tag-color") as HTMLInputElement).value;
    const severity = (modal.querySelector("#ct-tag-severity") as HTMLSelectElement).value;
    const description = (modal.querySelector("#ct-tag-description") as HTMLInputElement).value.trim();
    const scope = (modal.querySelector("input[name='ct-scope']:checked") as HTMLInputElement).value as "global" | "project";

    overlay.remove();
    opts.onSave({ name, color, severity, description, scope });
  });

  overlay.appendChild(modal);
  return overlay;
}
