import type { Tag } from "../state";

type ExportData = {
  version: "1.0";
  exported_at: string;
  source: "caido-tagger";
  tags: Array<{
    name: string;
    color: string;
    severity: string;
    description: string;
  }>;
};

export function exportTags(tags: Tag[]): void {
  const data: ExportData = {
    version: "1.0",
    exported_at: new Date().toISOString(),
    source: "caido-tagger",
    tags: tags.map((t) => ({
      name: t.name,
      color: t.color,
      severity: t.severity ?? "",
      description: t.description,
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
  onImport: (tags: ExportData["tags"]) => void,
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
        const raw = JSON.parse(e.target?.result as string) as ExportData;

        if (raw.source !== "caido-tagger" || raw.version !== "1.0") {
          onError("Invalid file format. Expected caido-tagger export.");
          return;
        }

        if (!Array.isArray(raw.tags)) {
          onError("No tags found in file.");
          return;
        }

        onImport(raw.tags);
      } catch {
        onError("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  });

  input.click();
}
