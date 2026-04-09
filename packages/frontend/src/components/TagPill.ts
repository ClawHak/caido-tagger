import type { Tag } from "../state";

export type TagPillOptions = {
  tag: Tag;
  onRemove?: () => void;
};

export function createTagPill(opts: TagPillOptions): HTMLElement {
  const pill = document.createElement("span");
  pill.className = "ct-tag-pill";
  pill.style.backgroundColor = opts.tag.color;
  pill.title = opts.tag.description || opts.tag.name;

  const label = document.createElement("span");
  label.textContent = opts.tag.name;
  pill.appendChild(label);

  if (opts.onRemove) {
    const btn = document.createElement("button");
    btn.className = "ct-tag-pill__remove";
    btn.textContent = "×";
    btn.title = `Remove ${opts.tag.name}`;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      opts.onRemove!();
    });
    pill.appendChild(btn);
  }

  return pill;
}

export function createTagPillsContainer(
  tags: Tag[],
  onRemove?: (tagId: string) => void
): HTMLElement {
  const container = document.createElement("div");
  container.className = "ct-tag-pills";

  tags.forEach((tag) => {
    container.appendChild(
      createTagPill({
        tag,
        onRemove: onRemove ? () => onRemove(tag.id) : undefined,
      })
    );
  });

  return container;
}
