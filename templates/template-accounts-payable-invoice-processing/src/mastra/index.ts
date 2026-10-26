import "dotenv/config";
import { chmodSync, closeSync, mkdirSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { accountsPayableAgent } from "./agents/accounts-payable.ts";
import { invoiceWorkflow } from "./workflows/invoice.ts";

export const defaultStoragePath = resolve(
  fileURLToPath(new URL("../../", import.meta.url)),
  "data/mastra.db",
);
const configuredStorageUrl = process.env.MASTRA_DB_URL?.trim() || undefined;
if (!configuredStorageUrl) {
  mkdirSync(dirname(defaultStoragePath), { recursive: true, mode: 0o700 });
  chmodSync(dirname(defaultStoragePath), 0o700);
  closeSync(openSync(defaultStoragePath, "a", 0o600));
  chmodSync(defaultStoragePath, 0o600);
}
const applicationStorage = new LibSQLStore({
  id: "ap-invoice-storage",
  url: configuredStorageUrl ?? `file:${defaultStoragePath}`,
});
export const mastra = new Mastra({
  agents: { accountsPayableAgent },
  workflows: { invoiceWorkflow },
  storage: applicationStorage,
});
