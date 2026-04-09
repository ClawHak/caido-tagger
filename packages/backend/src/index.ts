import { SDK, DefineAPI } from "caido:plugin";
import { getDb } from "./db";
import {
  createTag,
  getTags,
  getTagById,
  updateTag,
  deleteTag,
  setProjectOverride,
  removeProjectOverride,
  getProjectOverrides,
  getEffectiveSeverity,
} from "./tagger";
import {
  addTagToRequest,
  removeTagFromRequest,
  removeAllTagsFromRequest,
  getTagsForRequest,
  getTaggedRequestIds,
  isRequestTagged,
} from "./assignments";

// --- Exported types (used by frontend) ---

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

export type TaggedRequest = {
  request_id: string;
  tag_ids: string[];
  tagged_at: number;
};

export type CreateTagParams = {
  name: string;
  color: string;
  description?: string;
  severity?: Severity;
  scope: TagScope;
  project_id?: string;
};

export type UpdateTagParams = {
  name?: string;
  color?: string;
  description?: string;
  severity?: Severity;
};

export type RequestMeta = {
  id: string;
  method: string;
  host: string;
  path: string;
  query: string;
};

// --- API handlers ---

async function apiCreateTag(sdk: SDK, params: CreateTagParams): Promise<Tag> {
  const db = await getDb(sdk);
  return createTag(db, params);
}

async function apiGetTags(sdk: SDK, project_id?: string): Promise<Tag[]> {
  const db = await getDb(sdk);
  return getTags(db, project_id ? { project_id } : undefined);
}

async function apiGetTagById(sdk: SDK, id: string): Promise<Tag | undefined> {
  const db = await getDb(sdk);
  return getTagById(db, id);
}

async function apiUpdateTag(
  sdk: SDK,
  id: string,
  fields: UpdateTagParams
): Promise<Tag | undefined> {
  const db = await getDb(sdk);
  return updateTag(db, id, fields);
}

async function apiDeleteTag(sdk: SDK, id: string): Promise<void> {
  const db = await getDb(sdk);
  return deleteTag(db, id);
}

async function apiSetProjectOverride(
  sdk: SDK,
  tag_id: string,
  project_id: string,
  severity: Severity
): Promise<void> {
  const db = await getDb(sdk);
  return setProjectOverride(db, tag_id, project_id, severity);
}

async function apiRemoveProjectOverride(
  sdk: SDK,
  tag_id: string,
  project_id: string
): Promise<void> {
  const db = await getDb(sdk);
  return removeProjectOverride(db, tag_id, project_id);
}

async function apiGetProjectOverrides(
  sdk: SDK,
  project_id: string
): Promise<Record<string, Severity>> {
  const db = await getDb(sdk);
  return getProjectOverrides(db, project_id);
}

async function apiGetEffectiveSeverity(
  sdk: SDK,
  tag_id: string,
  project_id: string
): Promise<Severity | null> {
  const db = await getDb(sdk);
  return getEffectiveSeverity(db, tag_id, project_id);
}

async function apiAddTagToRequest(
  sdk: SDK,
  request_id: string,
  tag_id: string,
  project_id: string
): Promise<void> {
  const db = await getDb(sdk);
  return addTagToRequest(db, request_id, tag_id, project_id);
}

async function apiRemoveTagFromRequest(
  sdk: SDK,
  request_id: string,
  tag_id: string
): Promise<void> {
  const db = await getDb(sdk);
  return removeTagFromRequest(db, request_id, tag_id);
}

async function apiRemoveAllTagsFromRequest(
  sdk: SDK,
  request_id: string,
  project_id: string
): Promise<void> {
  const db = await getDb(sdk);
  return removeAllTagsFromRequest(db, request_id, project_id);
}

async function apiGetTagsForRequest(
  sdk: SDK,
  request_id: string,
  project_id: string
): Promise<Tag[]> {
  const db = await getDb(sdk);
  return getTagsForRequest(db, request_id, project_id);
}

async function apiGetTaggedRequestIds(
  sdk: SDK,
  project_id: string,
  tag_ids?: string[]
): Promise<TaggedRequest[]> {
  const db = await getDb(sdk);
  return getTaggedRequestIds(db, project_id, tag_ids);
}

async function apiIsRequestTagged(
  sdk: SDK,
  request_id: string,
  project_id: string
): Promise<boolean> {
  const db = await getDb(sdk);
  return isRequestTagged(db, request_id, project_id);
}

async function apiGetRequestMeta(
  sdk: SDK,
  request_ids: string[]
): Promise<RequestMeta[]> {
  const results: RequestMeta[] = [];
  for (const id of request_ids) {
    const item = await sdk.requests.get(id);
    if (item) {
      results.push({
        id,
        method: item.request.getMethod(),
        host: item.request.getHost(),
        path: item.request.getPath(),
        query: item.request.getQuery(),
      });
    }
  }
  return results;
}

function apiPing(_sdk: SDK): string {
  return "caido-tagger backend ready";
}

// --- API surface ---

export type API = DefineAPI<{
  ping: typeof apiPing;
  getRequestMeta: typeof apiGetRequestMeta;
  // Tag CRUD
  createTag: typeof apiCreateTag;
  getTags: typeof apiGetTags;
  getTagById: typeof apiGetTagById;
  updateTag: typeof apiUpdateTag;
  deleteTag: typeof apiDeleteTag;
  // Project overrides
  setProjectOverride: typeof apiSetProjectOverride;
  removeProjectOverride: typeof apiRemoveProjectOverride;
  getProjectOverrides: typeof apiGetProjectOverrides;
  getEffectiveSeverity: typeof apiGetEffectiveSeverity;
  // Assignments
  addTagToRequest: typeof apiAddTagToRequest;
  removeTagFromRequest: typeof apiRemoveTagFromRequest;
  removeAllTagsFromRequest: typeof apiRemoveAllTagsFromRequest;
  getTagsForRequest: typeof apiGetTagsForRequest;
  getTaggedRequestIds: typeof apiGetTaggedRequestIds;
  isRequestTagged: typeof apiIsRequestTagged;
}>;

// --- Plugin init ---

export function init(sdk: SDK<API>) {
  sdk.api.register("ping", apiPing);
  sdk.api.register("getRequestMeta", apiGetRequestMeta);

  // Tag CRUD
  sdk.api.register("createTag", apiCreateTag);
  sdk.api.register("getTags", apiGetTags);
  sdk.api.register("getTagById", apiGetTagById);
  sdk.api.register("updateTag", apiUpdateTag);
  sdk.api.register("deleteTag", apiDeleteTag);

  // Project overrides
  sdk.api.register("setProjectOverride", apiSetProjectOverride);
  sdk.api.register("removeProjectOverride", apiRemoveProjectOverride);
  sdk.api.register("getProjectOverrides", apiGetProjectOverrides);
  sdk.api.register("getEffectiveSeverity", apiGetEffectiveSeverity);

  // Assignments
  sdk.api.register("addTagToRequest", apiAddTagToRequest);
  sdk.api.register("removeTagFromRequest", apiRemoveTagFromRequest);
  sdk.api.register("removeAllTagsFromRequest", apiRemoveAllTagsFromRequest);
  sdk.api.register("getTagsForRequest", apiGetTagsForRequest);
  sdk.api.register("getTaggedRequestIds", apiGetTaggedRequestIds);
  sdk.api.register("isRequestTagged", apiIsRequestTagged);

  // Initialize DB eagerly on startup
  getDb(sdk).then(() => {
    sdk.console.log("caido-tagger: database initialized");
  }).catch((err) => {
    sdk.console.error(`caido-tagger: database init failed: ${err}`);
  });

  sdk.console.log("caido-tagger backend initialized");
}
