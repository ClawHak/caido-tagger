import { SDK, DefineAPI } from "caido:plugin";

// --- Types ---

export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type TagScope = "global" | "project";

export type Tag = {
  id: string;
  name: string;
  color: string;
  description: string;
  severity: Severity | null;
  scope: TagScope;
  project_id: string | null;
  created_at: number;
};

export type TagAssignment = {
  request_id: string;
  tag_id: string;
  project_id: string;
  tagged_at: number;
};

export type TagProjectOverride = {
  tag_id: string;
  project_id: string;
  severity: Severity;
};

// --- API surface (to be implemented in Phase 2) ---

function ping(_sdk: SDK): string {
  return "caido-tagger backend ready";
}

export type API = DefineAPI<{
  ping: typeof ping;
}>;

export function init(sdk: SDK<API>) {
  sdk.api.register("ping", ping);
  sdk.console.log("caido-tagger backend initialized");
}
