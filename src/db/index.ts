import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { env } from "../config/env";
import { relations } from "./relations";
import * as schema from "./schema";

mkdirSync(dirname(env.databasePath), { recursive: true });

const sqlite = new Database(env.databasePath, { create: true });
sqlite.run("PRAGMA journal_mode = WAL;");

export const db = drizzle<typeof schema, typeof relations>({
  client: sqlite,
  schema,
  relations,
});

export function runMigrations() {
  migrate(db, { migrationsFolder: "./drizzle" });
}

export function closeDatabase() {
  sqlite.close();
}
