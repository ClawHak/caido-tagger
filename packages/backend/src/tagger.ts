import { Database } from "sqlite";
import { Tag, Severity, TagScope } from "./index";
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
    description: row.description,
    severity: (row.severity as Severity) ?? null,
    scope: row.scope as TagScope,
    project_id: row.project_id,
    created_at: row.created_at,
  };
}

// --- Tag CRUD ---

export async function createTag(
  db: Database,
  params: {
    name: string;
    color: string;
    description?: string;
    severity?: Severity;
    scope: TagScope;
    project_id?: string;
  }
): Promise<Tag> {
  const tag: Tag = {
    id: uuid(),
    name: params.name,
    color: params.color,
    description: params.description ?? "",
    severity: params.severity ?? null,
    scope: params.scope,
    project_id: params.project_id ?? null,
    created_at: now(),
  };

  await db
    .prepare(
      `INSERT INTO tags (id, name, color, description, severity, scope, project_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      tag.id,
      tag.name,
      tag.color,
      tag.description,
      tag.severity,
      tag.scope,
      tag.project_id,
      tag.created_at
    );

  return tag;
}

export async function getTags(
  db: Database,
  opts?: { project_id?: string }
): Promise<Tag[]> {
  // Return global tags + project-specific tags for the given project
  if (opts?.project_id) {
    const rows = await db
      .prepare(
        `SELECT * FROM tags
         WHERE scope = 'global'
            OR (scope = 'project' AND project_id = ?)
         ORDER BY created_at ASC`
      )
      .all<TagRow>(opts.project_id);
    return rows.map(rowToTag);
  }

  const rows = await db
    .prepare(`SELECT * FROM tags WHERE scope = 'global' ORDER BY created_at ASC`)
    .all<TagRow>();
  return rows.map(rowToTag);
}

export async function getTagById(
  db: Database,
  id: string
): Promise<Tag | undefined> {
  const row = await db
    .prepare(`SELECT * FROM tags WHERE id = ?`)
    .get<TagRow>(id);
  return row ? rowToTag(row) : undefined;
}

export async function updateTag(
  db: Database,
  id: string,
  fields: Partial<Pick<Tag, "name" | "color" | "description" | "severity">>
): Promise<Tag | undefined> {
  const existing = await getTagById(db, id);
  if (!existing) return undefined;

  const updated: Tag = {
    ...existing,
    name: fields.name ?? existing.name,
    color: fields.color ?? existing.color,
    description: fields.description ?? existing.description,
    severity: fields.severity !== undefined ? fields.severity : existing.severity,
  };

  await db
    .prepare(
      `UPDATE tags SET name = ?, color = ?, description = ?, severity = ? WHERE id = ?`
    )
    .run(updated.name, updated.color, updated.description, updated.severity, id);

  return updated;
}

export async function deleteTag(db: Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM request_tags WHERE tag_id = ?`).run(id);
  await db.prepare(`DELETE FROM tag_project_overrides WHERE tag_id = ?`).run(id);
  await db.prepare(`DELETE FROM tags WHERE id = ?`).run(id);
}

// --- Project severity overrides ---

export async function setProjectOverride(
  db: Database,
  tag_id: string,
  project_id: string,
  severity: Severity
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO tag_project_overrides (tag_id, project_id, severity)
       VALUES (?, ?, ?)
       ON CONFLICT(tag_id, project_id) DO UPDATE SET severity = excluded.severity`
    )
    .run(tag_id, project_id, severity);
}

export async function removeProjectOverride(
  db: Database,
  tag_id: string,
  project_id: string
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM tag_project_overrides WHERE tag_id = ? AND project_id = ?`
    )
    .run(tag_id, project_id);
}

export async function getProjectOverrides(
  db: Database,
  project_id: string
): Promise<Record<string, Severity>> {
  const rows = await db
    .prepare(
      `SELECT tag_id, severity FROM tag_project_overrides WHERE project_id = ?`
    )
    .all<{ tag_id: string; severity: string }>(project_id);

  return Object.fromEntries(rows.map((r) => [r.tag_id, r.severity as Severity]));
}

export async function getEffectiveSeverity(
  db: Database,
  tag_id: string,
  project_id: string
): Promise<Severity | null> {
  const override = await db
    .prepare(
      `SELECT severity FROM tag_project_overrides WHERE tag_id = ? AND project_id = ?`
    )
    .get<OverrideRow>(tag_id, project_id);

  if (override) return override.severity as Severity;

  const tag = await getTagById(db, tag_id);
  return tag?.severity ?? null;
}
