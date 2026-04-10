import { Tag, Severity, TagScope } from "./index";
import { AsyncDB } from "./db";
import { uuid, now } from "./utils";

export type TagRow = {
  id: string;
  name: string;
  color: string;
  description: string;
  severity: string | null;
  scope: string;
  project_id: string | null;
  created_at: number;
};

type OverrideRow = {
  severity: string;
};

export function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    description: row.description ?? "",
    severity: row.severity ?? "",
    scope: row.scope as TagScope,
    project_id: row.project_id ?? "",
    created_at: row.created_at,
  };
}

// --- Tag CRUD ---

export async function createTag(
  db: AsyncDB,
  params: {
    name: string;
    color: string;
    description: string;
    severity: string;   // "" means no severity
    scope: TagScope;
    project_id: string; // "" means global
  }
): Promise<Tag> {
  const id = uuid();
  const created_at = now();
  // Store "" for nullable fields — Caido's RPC/SQLite doesn't accept null params
  const severity = params.severity || "";
  const project_id = params.project_id || "";

  await (await db.prepare(
    `INSERT INTO tags (id, name, color, description, severity, scope, project_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )).run(id, params.name, params.color, params.description, severity, params.scope, project_id, created_at);

  return rowToTag({
    id,
    name: params.name,
    color: params.color,
    description: params.description,
    severity,
    scope: params.scope,
    project_id,
    created_at,
  });
}

export async function getTags(
  db: AsyncDB,
  opts?: { project_id?: string }
): Promise<Tag[]> {
  if (opts?.project_id) {
    const rows = await (await db.prepare(
      `SELECT * FROM tags
       WHERE scope = 'global'
          OR (scope = 'project' AND project_id = ?)
       ORDER BY created_at ASC`
    )).all<TagRow>(opts.project_id);
    return rows.map(rowToTag);
  }

  const rows = await (await db.prepare(
    `SELECT * FROM tags WHERE scope = 'global' ORDER BY created_at ASC`
  )).all<TagRow>();
  return rows.map(rowToTag);
}

export async function getTagById(
  db: AsyncDB,
  id: string
): Promise<Tag | undefined> {
  const row = await (await db.prepare(
    `SELECT * FROM tags WHERE id = ?`
  )).get<TagRow>(id);
  return row ? rowToTag(row) : undefined;
}

export async function updateTag(
  db: AsyncDB,
  id: string,
  fields: { name: string; color: string; description: string; severity: string }
): Promise<Tag | undefined> {
  const existing = await getTagById(db, id);
  if (!existing) return undefined;

  const severity = fields.severity || "";  // "" means no severity
  await (await db.prepare(
    `UPDATE tags SET name = ?, color = ?, description = ?, severity = ? WHERE id = ?`
  )).run(fields.name, fields.color, fields.description, severity, id);

  return rowToTag({
    ...existing,
    name: fields.name,
    color: fields.color,
    description: fields.description,
    severity,
    project_id: existing.project_id ?? "",
    created_at: existing.created_at,
  });
}

export async function deleteTag(db: AsyncDB, id: string): Promise<void> {
  await (await db.prepare(`DELETE FROM request_tags WHERE tag_id = ?`)).run(id);
  await (await db.prepare(`DELETE FROM tag_project_overrides WHERE tag_id = ?`)).run(id);
  await (await db.prepare(`DELETE FROM tags WHERE id = ?`)).run(id);
}

// --- Project severity overrides ---

export async function setProjectOverride(
  db: AsyncDB,
  tag_id: string,
  project_id: string,
  severity: Severity
): Promise<void> {
  await (await db.prepare(
    `INSERT INTO tag_project_overrides (tag_id, project_id, severity)
     VALUES (?, ?, ?)
     ON CONFLICT(tag_id, project_id) DO UPDATE SET severity = excluded.severity`
  )).run(tag_id, project_id, severity);
}

export async function removeProjectOverride(
  db: AsyncDB,
  tag_id: string,
  project_id: string
): Promise<void> {
  await (await db.prepare(
    `DELETE FROM tag_project_overrides WHERE tag_id = ? AND project_id = ?`
  )).run(tag_id, project_id);
}

export async function getProjectOverrides(
  db: AsyncDB,
  project_id: string
): Promise<Record<string, Severity>> {
  const rows = await (await db.prepare(
    `SELECT tag_id, severity FROM tag_project_overrides WHERE project_id = ?`
  )).all<{ tag_id: string; severity: string }>(project_id);

  return Object.fromEntries(rows.map((r) => [r.tag_id, r.severity as Severity]));
}

export async function getEffectiveSeverity(
  db: AsyncDB,
  tag_id: string,
  project_id: string
): Promise<Severity | null> {
  const override = await (await db.prepare(
    `SELECT severity FROM tag_project_overrides WHERE tag_id = ? AND project_id = ?`
  )).get<OverrideRow>(tag_id, project_id);

  if (override) return override.severity as Severity;

  const tag = await getTagById(db, tag_id);
  return tag?.severity ?? null;
}
