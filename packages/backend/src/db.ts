import { SDK } from "caido:plugin";
import { Database, Statement } from "sqlite";

// In Caido's QuickJS runtime, db.prepare() is actually async (returns Promise<Statement>)
// despite the TypeScript types declaring it as synchronous.
// AsyncDB wraps the raw Database so all callers can use `await db.prepare(sql)` safely.
export type AsyncDB = {
  exec(sql: string): Promise<void>;
  prepare(sql: string): Promise<Statement>;
};

let _initPromise: Promise<AsyncDB> | null = null;

export function getDb(sdk: SDK): Promise<AsyncDB> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    const rawDb = await sdk.meta.db();
    const db = wrapDb(rawDb);
    await initSchema(db, sdk);
    return db;
  })().catch((err) => {
    _initPromise = null; // allow retry on next call
    throw err;
  });
  return _initPromise;
}

function wrapDb(rawDb: Database): AsyncDB {
  return {
    exec: (sql) => rawDb.exec(sql),
    prepare: async (sql) => rawDb.prepare(sql) as unknown as Promise<Statement>,
  };
}

async function initSchema(db: AsyncDB, sdk: SDK): Promise<void> {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)"
  );

  const row = await (await db.prepare("SELECT version FROM schema_version LIMIT 1")).get<{ version: number }>();
  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    await migrate_v1(db, sdk);
    if (currentVersion === 0) {
      await (await db.prepare("INSERT INTO schema_version (version) VALUES (?)")).run(1);
    } else {
      await (await db.prepare("UPDATE schema_version SET version = ?")).run(1);
    }
    sdk.console.log("caido-tagger: schema v1 migration complete");
  }
}

async function migrate_v1(db: AsyncDB, sdk: SDK): Promise<void> {
  sdk.console.log("caido-tagger: running migration v1...");

  await (await db.prepare(`
    CREATE TABLE IF NOT EXISTS tags (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      color       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      severity    TEXT,
      scope       TEXT NOT NULL DEFAULT 'global',
      project_id  TEXT,
      created_at  INTEGER NOT NULL
    )
  `)).run();
  sdk.console.log("caido-tagger: tags table OK");

  await (await db.prepare(`
    CREATE TABLE IF NOT EXISTS tag_project_overrides (
      tag_id      TEXT NOT NULL,
      project_id  TEXT NOT NULL,
      severity    TEXT NOT NULL,
      PRIMARY KEY (tag_id, project_id)
    )
  `)).run();
  sdk.console.log("caido-tagger: tag_project_overrides table OK");

  await (await db.prepare(`
    CREATE TABLE IF NOT EXISTS request_tags (
      request_id  TEXT NOT NULL,
      tag_id      TEXT NOT NULL,
      project_id  TEXT NOT NULL,
      tagged_at   INTEGER NOT NULL,
      PRIMARY KEY (request_id, tag_id)
    )
  `)).run();
  sdk.console.log("caido-tagger: request_tags table OK");

  await (await db.prepare("CREATE INDEX IF NOT EXISTS idx_request_tags_request ON request_tags (request_id, project_id)")).run();
  await (await db.prepare("CREATE INDEX IF NOT EXISTS idx_request_tags_tag ON request_tags (tag_id, project_id)")).run();
  await (await db.prepare("CREATE INDEX IF NOT EXISTS idx_tags_scope ON tags (scope, project_id)")).run();
  sdk.console.log("caido-tagger: indexes OK");
}
