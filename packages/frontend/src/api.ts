import type { Caido } from "@caido/sdk-frontend";
import type { API } from "caido-tagger-backend";
import { setState } from "./state";
import type { Tag, Severity } from "./state";

type SDK = Caido<API>;

// --- Project ---

export async function loadProject(sdk: SDK): Promise<void> {
  const res = await sdk.graphql.currentProject();
  const p = res.currentProject;
  setState(() => ({
    projectId: p?.id ?? null,
    projectName: p?.name ?? null,
  }));
}

// --- Tags ---

export async function loadTags(sdk: SDK, projectId: string): Promise<void> {
  const [tags, overrides] = await Promise.all([
    sdk.backend.getTags(projectId),
    sdk.backend.getProjectOverrides(projectId),
  ]);
  setState(() => ({ tags, overrides }));
}

export async function createTag(
  sdk: SDK,
  params: Parameters<typeof sdk.backend.createTag>[0]
): Promise<Tag> {
  return sdk.backend.createTag(params);
}

export async function updateTag(
  sdk: SDK,
  id: string,
  fields: Parameters<typeof sdk.backend.updateTag>[1]
): Promise<Tag | undefined> {
  return sdk.backend.updateTag(id, fields);
}

export async function deleteTag(sdk: SDK, id: string): Promise<void> {
  return sdk.backend.deleteTag(id);
}

export async function setProjectOverride(
  sdk: SDK,
  tagId: string,
  projectId: string,
  severity: Severity
): Promise<void> {
  return sdk.backend.setProjectOverride(tagId, projectId, severity);
}

export async function removeProjectOverride(
  sdk: SDK,
  tagId: string,
  projectId: string
): Promise<void> {
  return sdk.backend.removeProjectOverride(tagId, projectId);
}

// --- Tagged Requests ---

export async function loadTaggedRequests(
  sdk: SDK,
  projectId: string,
  tagIds?: string[]
): Promise<void> {
  setState(() => ({ loading: true }));

  const tagged = await sdk.backend.getTaggedRequestIds(projectId, tagIds);

  // Fetch request metadata in batches of 20
  const ids = tagged.map((r) => r.request_id);
  const metas = await sdk.backend.getRequestMeta(ids);
  const metaMap = Object.fromEntries(metas.map((m) => [m.id, m]));

  setState(() => ({
    taggedRequests: tagged.map((r) => ({
      ...r,
      meta: metaMap[r.request_id],
    })),
    loading: false,
  }));
}

// --- Assignments ---

export async function addTag(
  sdk: SDK,
  requestId: string,
  tagId: string,
  projectId: string
): Promise<void> {
  await sdk.backend.addTagToRequest(requestId, tagId, projectId);
}

export async function removeTag(
  sdk: SDK,
  requestId: string,
  tagId: string
): Promise<void> {
  await sdk.backend.removeTagFromRequest(requestId, tagId);
}

export async function getTagsForRequest(
  sdk: SDK,
  requestId: string,
  projectId: string
): Promise<Tag[]> {
  return sdk.backend.getTagsForRequest(requestId, projectId);
}

// --- Replay ---

export async function sendToReplay(
  sdk: SDK,
  requestId: string
): Promise<void> {
  await sdk.graphql.createReplaySession({
    input: { requestSource: { id: requestId } },
  });
}

// --- Automate ---

export async function sendToAutomate(
  sdk: SDK,
  requestId: string
): Promise<void> {
  await sdk.graphql.createAutomateSession({
    input: { requestSource: { id: requestId } },
  });
}
