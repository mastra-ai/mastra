import { randomUUID } from "node:crypto";
import { lstat, mkdir, link, unlink, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DatasetMetadata } from "../data-sources/sales/contracts.ts";
import { DATA_RECOVERY_GUIDANCE, openSales, readMetadata } from "../data-sources/sales/database.ts";
import { createSchema } from "./schema.ts";
import { createMetadata, generateSales } from "./generate.ts";

async function existing(path: string): Promise<DatasetMetadata | null> {
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error(`Data path must be a regular file. ${DATA_RECOVERY_GUIDANCE}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const { db, metadata } = openSales(path);
  db.close();
  return metadata;
}

export async function initializeSales(
  path: string,
  options: { seed?: number; now?: () => Date } = {},
): Promise<DatasetMetadata> {
  const canonical = resolve(path);
  let saved: DatasetMetadata | null;
  try {
    saved = await existing(canonical);
  } catch (error) {
    throw new Error(
      `Cannot reuse Sales data at ${canonical}. Check the path and read permissions. ${DATA_RECOVERY_GUIDANCE}`,
      { cause: error },
    );
  }
  if (saved) return saved;
  const metadata = createMetadata((options.now ?? (() => new Date()))(), options.seed);
  const temporary = `${canonical}.${randomUUID()}.pending`;
  let db: DatabaseSync | undefined;
  let reserved = false;
  try {
    await mkdir(dirname(canonical), { recursive: true });
    // Reserve our unique temporary path without ever truncating an existing file.
    const reservation = await open(temporary, "wx", 0o600);
    reserved = true;
    await reservation.close();
    db = new DatabaseSync(temporary);
    db.exec("PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL; BEGIN IMMEDIATE");
    createSchema(db);
    generateSales(db, metadata);
    db.prepare("INSERT INTO dataset_metadata VALUES (1, ?)").run(JSON.stringify(metadata));
    db.exec("COMMIT");
    readMetadata(db);
    db.close();
    db = undefined;
    const file = await open(temporary, "r");
    try {
      await file.sync();
    } finally {
      await file.close();
    }
    try {
      // Hard-link publication is atomic and fails if a competing initializer won.
      await link(temporary, canonical);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const winner = await existing(canonical);
      if (!winner) throw new Error("The competing dataset disappeared; retry initialization.");
      return winner;
    }
    return metadata;
  } catch (error) {
    throw new Error(
      `Cannot initialize Sales data at ${canonical}. Check directory permissions and free space, then retry. ${DATA_RECOVERY_GUIDANCE}`,
      { cause: error },
    );
  } finally {
    db?.close();
    if (reserved)
      await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT")
          throw new Error(
            `Remove the abandoned initialization file ${temporary} after checking permissions.`,
            { cause: error },
          );
      });
  }
}
