import { SDK } from "caido:plugin";
import { Database } from "sqlite";

let _db: Database | null = null;

export async function getDb(sdk: SDK): Promise<Database> {
  if (_db) return _db;
  _db = await sdk.meta.db();
  await initSchema(_db);
  return _db;
}

async function initSchema(db: Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );
  `);

  const row = await db.prepare("SELECT version FROM schema_version LIMIT 1").get<{ version: number }>();
  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    await migrate_v1(db);
    if (currentVersion === 0) {
      await db.exec("INSERT INTO schema_version (version) VALUES (1)");
    } else {
      await db.exec("UPDATE schema_version SET version = 1");
    }
  }
}

async function migrate_v1(db: Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      color       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      severity    TEXT,
      scope       TEXT NOT NULL DEFAULT 'global',
      project_id  TEXT,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tag_project_overrides (
      tag_id      TEXT NOT NULL,
      project_id  TEXT NOT NULL,
      severity    TEXT NOT NULL,
      PRIMARY KEY (tag_id, project_id)
    );

    CREATE TABLE IF NOT EXISTS request_tags (
      request_id  TEXT NOT NULL,
      tag_id      TEXT NOT NULL,
      project_id  TEXT NOT NULL,
      tagged_at   INTEGER NOT NULL,
      PRIMARY KEY (request_id, tag_id)
    );

    CREATE INDEX IF NOT EXISTS idx_request_tags_request ON request_tags (request_id, project_id);
    CREATE INDEX IF NOT EXISTS idx_request_tags_tag ON request_tags (tag_id, project_id);
    CREATE INDEX IF NOT EXISTS idx_tags_scope ON tags (scope, project_id);
  `);
}
