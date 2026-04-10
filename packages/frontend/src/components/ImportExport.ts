import type { Tag } from "../state";

type ExportedTag = {
  name: string;
  color: string;
  severity: string;
  description: string;
  scope: "global" | "project";
};

type ExportData = {
  version: "1.1";
  exported_at: string;
  source: "caido-tagger";
  tags: ExportedTag[];
};

export function exportTags(tags: Tag[]): void {
  const data: ExportData = {
    version: "1.1",
    exported_at: new Date().toISOString(),
    source: "caido-tagger",
    tags: tags.map((t) => ({
      name: t.name,
      color: t.color,
      severity: t.severity ?? "",
      description: t.description,
      scope: t.scope,
    })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `caido-tagger-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importTags(
  onImport: (tags: ExportedTag[]) => void,
  onError: (msg: string) => void
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string) as Record<string, unknown>;

        if (raw["source"] !== "caido-tagger") {
          onError("Invalid file format. Expected caido-tagger export.");
          return;
        }

        if (!Array.isArray(raw["tags"])) {
          onError("No tags found in file.");
          return;
        }

        // Normalise: v1.0 files have no scope field → default to "global"
        const tags: ExportedTag[] = (raw["tags"] as Record<string, unknown>[]).map((t) => ({
          name: String(t["name"] ?? ""),
          color: String(t["color"] ?? "#e74c3c"),
          severity: String(t["severity"] ?? ""),
          description: String(t["description"] ?? ""),
          scope: (t["scope"] === "project" ? "project" : "global") as "global" | "project",
        }));

        onImport(tags);
      } catch {
        onError("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  });

  input.click();
}

export type { ExportedTag };
