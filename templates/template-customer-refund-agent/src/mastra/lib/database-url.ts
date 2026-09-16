import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { databaseProfile } from "../../../config/app-mode.mjs";

const defaultDatabaseFile = "mastra.db";

/**
 * Resolve the local SQLite URL before any process changes its working
 * directory. Mastra's CLI runs dev and built children from different
 * directories, so a relative file URL is not a stable database identity.
 */
export function resolveDatabaseUrl(
  value = databaseProfile().backend,
  cwd = process.cwd(),
) {
  const url = value?.trim() || `file:${defaultDatabaseFile}`;
  if (!url.startsWith("file:") || url.includes(":memory:")) return url;
  return new URL(url, pathToFileURL(`${resolve(cwd)}/`)).href;
}

export function requireLocalDatabaseUrl(
  value = databaseProfile().backend,
  cwd = process.cwd(),
) {
  const url = resolveDatabaseUrl(value, cwd);
  if (!url.startsWith("file:"))
    throw new Error("DATABASE_URL must use a file: URL for local data.");
  return url;
}
