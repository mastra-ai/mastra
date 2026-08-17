/**
 * Where the database lives — resolved absolutely, on purpose.
 *
 * This looks like over-engineering until it bites you. `mastra dev` does not
 * run with the project root as its working directory: it runs from
 * `<project>/src/mastra/public`. A script you launch yourself (`pnpm seed`)
 * runs from `<project>`. So a relative URL like `file:./eval.db` silently
 * resolves to two different files, and you get the most confusing possible
 * symptom — the seed reports success, the dashboard shows nothing, and both
 * are telling the truth about different databases.
 *
 * Walking up to the nearest package.json gives the same absolute path from
 * either starting point, without depending on shell variables (so it still
 * works on Windows).
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

function findProjectRoot(start: string = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

/** Absolute `file:` URL shared by the dev server and every script. */
export const DATABASE_URL = process.env.DATABASE_URL ?? `file:${join(findProjectRoot(), 'eval.db')}`;

/**
 * Absolute path for the DuckDB observability database.
 *
 * Same reasoning, same trap: DuckDB's default path is the relative string
 * `'mastra.duckdb'`, so without this the dev server and `pnpm seed` would each
 * create their own copy and the score charts would stay empty.
 */
export const DUCKDB_PATH = process.env.DUCKDB_PATH ?? join(findProjectRoot(), 'observability.duckdb');

/**
 * Absolute path to the workspace root — the directory Studio's Workspaces
 * page browses, and the one the skills under `skills/` are read from.
 *
 * Same trap as above, and worse here: a relative `basePath` would resolve
 * against `<project>/src/mastra/public` under `mastra dev`, so the Files tab
 * would show an empty directory and the Skills tab would find nothing, with
 * no error to explain either.
 */
export const WORKSPACE_PATH = process.env.WORKSPACE_PATH ?? join(findProjectRoot(), 'workspace');
