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
 * The CLI already knows the answer and exports it as `MASTRA_PROJECT_ROOT`, so
 * that comes first. Walking up to the nearest package.json is the fallback for
 * a plain `tsx` run, and it gives the same absolute path from either starting
 * point without depending on shell variables (so it still works on Windows).
 *
 * The fallback alone is not enough: `mastra start` runs the built `index.mjs`
 * with `<project>/.mastra/output` as its cwd, and the build writes a
 * package.json *there*. Walking up would stop at the output directory and put
 * the databases and the workspace inside build output.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

function findProjectRoot(start: string = process.cwd()): string {
  // Set by `mastra dev` and `mastra start` to the real project root.
  const fromCli = process.env.MASTRA_PROJECT_ROOT;
  if (fromCli) return fromCli;

  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'package.json'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

/**
 * Absolute `file:` URL shared by the dev server and every script.
 *
 * Built with `pathToFileURL` rather than string concatenation so a `#` or `?`
 * anywhere in the checkout path is percent-encoded. Interpolated raw, libsql
 * would read either character as the start of a fragment or query and open a
 * truncated path.
 */
export const DATABASE_URL = process.env.DATABASE_URL ?? pathToFileURL(join(findProjectRoot(), 'eval.db')).href;

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
