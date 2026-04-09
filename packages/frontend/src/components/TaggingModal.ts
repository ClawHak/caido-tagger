// Modal shown when right-clicking a request in HTTP History → "Tag Request"
// Lists all tags with toggle state for the selected request(s)

import type { Caido } from "@caido/sdk-frontend";
import type { API } from "caido-tagger-backend";
import { createTagPill } from "./TagPill";
import { getState } from "../state";
import { addTag, removeTag, loadTaggedRequests } from "../api";

type SDK = Caido<API>;

type TaggingModalOptions = {
  sdk: SDK;
  requestIds: string[];
  projectId: string;
  onDone: () => void;
};

export function createTaggingModal(opts: TaggingModalOptions): HTMLElement {
  const { sdk, requestIds, projectId } = opts;
  const { tags } = getState();

  const overlay = document.createElement("div");
  overlay.className = "ct-modal-overlay";

  const modal = document.createElement("div");
  modal.className = "ct-modal ct-modal--tagging";

  const title =
    requestIds.length === 1
      ? "Tag Request"
      : `Tag ${requestIds.length} Requests`;

  modal.innerHTML = `
    <div class="ct-modal__header">
      <h3>${title}</h3>
      <button class="ct-modal__close">×</button>
    </div>
    <div class="ct-modal__body">
      ${
        tags.length === 0
          ? `<p class="ct-muted">No tags defined yet. Create tags in the <strong>Tag Config</strong> tab first.</p>`
          : `<div class="ct-tag-toggle-list" id="ct-tag-toggle-list"></div>`
      }
    </div>
    <div class="ct-modal__footer">
      <button class="ct-btn ct-btn--primary" id="ct-tagging-done">Done</button>
    </div>
  `;

  const close = () => {
    overlay.remove();
    opts.onDone();
  };

  modal.querySelector(".ct-modal__close")!.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  modal.querySelector("#ct-tagging-done")!.addEventListener("click", close);

  const list = modal.querySelector("#ct-tag-toggle-list");
  if (list && tags.length > 0) {
    tags.forEach((tag) => {
      const row = document.createElement("div");
      row.className = "ct-tag-toggle-row";

      const pill = createTagPill({ tag });
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.className = "ct-toggle";
      toggle.dataset["tagId"] = tag.id;

      toggle.addEventListener("change", async () => {
        if (toggle.checked) {
          await Promise.all(
            requestIds.map((rid) => addTag(sdk, rid, tag.id, projectId))
          );
        } else {
          await Promise.all(
            requestIds.map((rid) => removeTag(sdk, rid, tag.id))
          );
        }
        // Reload tagged requests in background
        loadTaggedRequests(sdk, projectId);
      });

      row.appendChild(toggle);
      row.appendChild(pill);
      list.appendChild(row);
    });

    // Pre-check tags if single request
    if (requestIds.length === 1) {
      sdk.backend
        .getTagsForRequest(requestIds[0]!, projectId)
        .then((existingTags) => {
          existingTags.forEach((t) => {
            const cb = list.querySelector<HTMLInputElement>(
              `input[data-tag-id="${t.id}"]`
            );
            if (cb) cb.checked = true;
          });
        });
    }
  }

  overlay.appendChild(modal);
  return overlay;
}
