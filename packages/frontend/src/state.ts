import type { Tag, TaggedRequest, RequestMeta } from "caido-tagger-backend";

export type { Tag, TaggedRequest, RequestMeta };

export type ActiveTab = "tagged-requests" | "tag-config";
export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type TaggedRequestRow = {
  request_id: string;
  tag_ids: string[];
  tagged_at: number;
  meta?: RequestMeta;
};

export type AppState = {
  projectId: string | null;
  projectName: string | null;
  activeTab: ActiveTab;
  tags: Tag[];
  overrides: Record<string, Severity>;
  taggedRequests: TaggedRequestRow[];
  selectedIds: Set<string>;
  filterTagIds: string[];
  filterSeverity: string;
  filterSearch: string;
  loading: boolean;
};

type Listener = () => void;

const state: AppState = {
  projectId: null,
  projectName: null,
  activeTab: "tagged-requests",
  tags: [],
  overrides: {},
  taggedRequests: [],
  selectedIds: new Set(),
  filterTagIds: [],
  filterSeverity: "",
  filterSearch: "",
  loading: false,
};

const listeners = new Set<Listener>();

export function getState(): Readonly<AppState> {
  return state;
}

export function setState(fn: (s: AppState) => Partial<AppState>): void {
  const patch = fn(state);
  Object.assign(state, patch);
  listeners.forEach((l) => l());
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function filteredRequests(): TaggedRequestRow[] {
  const { taggedRequests, filterTagIds, filterSeverity, filterSearch, tags } = state;

  return taggedRequests.filter((row) => {
    // Tag filter
    if (filterTagIds.length > 0) {
      if (!filterTagIds.every((tid) => row.tag_ids.includes(tid))) return false;
    }

    // Severity filter
    if (filterSeverity) {
      const rowTags = tags.filter((t) => row.tag_ids.includes(t.id));
      const effectiveSeverities = rowTags.map(
        (t) => state.overrides[t.id] ?? t.severity
      );
      if (!effectiveSeverities.includes(filterSeverity as Severity)) return false;
    }

    // Search filter (host + path)
    if (filterSearch && row.meta) {
      const q = filterSearch.toLowerCase();
      const hay = `${row.meta.host}${row.meta.path}${row.meta.query}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}
