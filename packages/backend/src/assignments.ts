import { Tag, TaggedRequest } from "./index";
import { AsyncDB } from "./db";
import { rowToTag, TagRow } from "./tagger";
import { now } from "./utils";

type AssignmentRow = {
  request_id: string;
  tag_id: string;
  project_id: string;
  tagged_at: number;
};

export async function addTagToRequest(
  db: AsyncDB,
  request_id: string,
  tag_id: string,
  project_id: string
): Promise<void> {
  await (await db.prepare(
    `INSERT OR IGNORE INTO request_tags (request_id, tag_id, project_id, tagged_at)
     VALUES (?, ?, ?, ?)`
  )).run(request_id, tag_id, project_id, now());
}

export async function removeTagFromRequest(
  db: AsyncDB,
  request_id: string,
  tag_id: string
): Promise<void> {
  await (await db.prepare(
    `DELETE FROM request_tags WHERE request_id = ? AND tag_id = ?`
  )).run(request_id, tag_id);
}

export async function removeAllTagsFromRequest(
  db: AsyncDB,
  request_id: string,
  project_id: string
): Promise<void> {
  await (await db.prepare(
    `DELETE FROM request_tags WHERE request_id = ? AND project_id = ?`
  )).run(request_id, project_id);
}

export async function getTagsForRequest(
  db: AsyncDB,
  request_id: string,
  project_id: string
): Promise<Tag[]> {
  const rows = await (await db.prepare(
    `SELECT t.* FROM tags t
     INNER JOIN request_tags rt ON rt.tag_id = t.id
     WHERE rt.request_id = ? AND rt.project_id = ?
     ORDER BY t.name ASC`
  )).all<TagRow>(request_id, project_id);

  return rows.map(rowToTag);
}

export async function getTaggedRequestIds(
  db: AsyncDB,
  project_id: string,
  tag_ids?: string[]
): Promise<TaggedRequest[]> {
  if (tag_ids && tag_ids.length > 0) {
    const placeholders = tag_ids.map(() => "?").join(", ");
    const rows = await (await db.prepare(
      `SELECT rt.request_id, rt.tagged_at,
              GROUP_CONCAT(rt.tag_id) as tag_ids_csv
       FROM request_tags rt
       WHERE rt.project_id = ?
         AND rt.tag_id IN (${placeholders})
       GROUP BY rt.request_id
       HAVING COUNT(DISTINCT rt.tag_id) = ?
       ORDER BY rt.tagged_at DESC`
    )).all<{ request_id: string; tagged_at: number; tag_ids_csv: string }>(
      project_id,
      ...tag_ids,
      tag_ids.length
    );

    return rows.map((r) => ({
      request_id: r.request_id,
      tag_ids: r.tag_ids_csv.split(","),
      tagged_at: r.tagged_at,
    }));
  }

  const rows = await (await db.prepare(
    `SELECT rt.request_id, rt.tagged_at,
            GROUP_CONCAT(rt.tag_id) as tag_ids_csv
     FROM request_tags rt
     WHERE rt.project_id = ?
     GROUP BY rt.request_id
     ORDER BY rt.tagged_at DESC`
  )).all<{ request_id: string; tagged_at: number; tag_ids_csv: string }>(
    project_id
  );

  return rows.map((r) => ({
    request_id: r.request_id,
    tag_ids: r.tag_ids_csv.split(","),
    tagged_at: r.tagged_at,
  }));
}

export async function isRequestTagged(
  db: AsyncDB,
  request_id: string,
  project_id: string
): Promise<boolean> {
  const row = await (await db.prepare(
    `SELECT 1 FROM request_tags WHERE request_id = ? AND project_id = ? LIMIT 1`
  )).get<{ 1: number }>(request_id, project_id);
  return row !== undefined;
}
