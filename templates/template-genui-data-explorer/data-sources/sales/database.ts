import { DatabaseSync } from "node:sqlite";
import { completeMonthCoverage, dateOnly, shiftDays, shiftMonths } from "./calendar.ts";
import { VERSIONS } from "./contracts.ts";
import type { DatasetMetadata } from "./contracts.ts";

export const DATA_RECOVERY_GUIDANCE =
  "Preserve the existing file. Choose a new empty data path, or back up and explicitly move the old file before retrying.";

export function readMetadata(db: DatabaseSync): DatasetMetadata {
  const row = db.prepare("SELECT json FROM dataset_metadata WHERE id = 1").get();
  if (typeof row?.json !== "string") throw new Error("Missing completed dataset metadata.");
  const data = JSON.parse(row.json) as DatasetMetadata;
  if (
    data.schema !== VERSIONS.schema ||
    data.generator !== VERSIONS.generator ||
    data.metrics !== VERSIONS.metrics ||
    data.complete !== true ||
    data.currency !== "USD" ||
    data.timezone !== "UTC" ||
    !Number.isSafeInteger(data.seed) ||
    data.seed < 0 ||
    data.seed > 0xffffffff
  )
    throw new Error("Incompatible or incomplete dataset metadata.");
  const anchor = new Date(data.anchor);
  const expected = completeMonthCoverage(anchor);
  dateOnly(data.coverage.start);
  dateOnly(data.coverage.end);
  dateOnly(data.asOf);
  if (
    data.anchor !== anchor.toISOString() ||
    data.coverage.start !== expected.start ||
    data.coverage.end !== expected.end ||
    data.asOf !== shiftDays(data.coverage.end, -1)
  )
    throw new Error("Dataset calendar metadata is inconsistent.");
  const months = db.prepare("SELECT start, end FROM months ORDER BY start").all();
  if (
    months.length !== 24 ||
    months.some(
      (month, index) =>
        month.start !== shiftMonths(data.coverage.start, index) ||
        month.end !== shiftMonths(data.coverage.start, index + 1),
    )
  )
    throw new Error("Dataset must contain exactly 24 completed months.");
  if (
    db.prepare("PRAGMA quick_check").get()?.quick_check !== "ok" ||
    db.prepare("PRAGMA foreign_key_check").all().length
  )
    throw new Error("Dataset integrity check failed.");
  for (const table of [
    "accounts",
    "representatives",
    "opportunities",
    "opportunity_history",
    "subscriptions",
    "subscription_history",
  ])
    db.prepare(`SELECT COUNT(*) FROM ${table}`).get();
  return data;
}

export function openSales(path: string): { db: DatabaseSync; metadata: DatasetMetadata } {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(path, { readOnly: true, allowExtension: false });
    const metadata = readMetadata(db);
    return { db, metadata };
  } catch (error) {
    db?.close();
    throw new Error(`Cannot open the Sales dataset at ${path}. ${DATA_RECOVERY_GUIDANCE}`, {
      cause: error,
    });
  }
}
