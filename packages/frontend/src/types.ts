export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type TagScope = "global" | "project";
export type ActiveTab = "tagged-requests" | "tag-config";

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

export type TaggedRequest = {
  request_id: string;
  tag_ids: string[];
  method: string;
  host: string;
  path: string;
  tagged_at: number;
};
