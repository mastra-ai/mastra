import { resolve } from "node:path";
import { LibSQLStore } from "@mastra/libsql";
import { localObservability } from "../observability/native.ts";
import type { createWorkspace } from "../workspace/create.ts";
import { dataDirectory } from "./configuration.ts";

export const traceStorage = new LibSQLStore({
  id: "local-traces",
  url: `file:${resolve(dataDirectory, "traces.sqlite")}`,
});
await traceStorage.init();
export const observability = localObservability();

export function closeOnShutdown(workspace: Awaited<ReturnType<typeof createWorkspace>>) {
  let closing: Promise<void> | undefined;
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => {
      closing ??= (async () => {
        for (const step of [
          () => observability.shutdown(),
          () => workspace.engine.close(),
          () => workspace.storage.close(),
          () => traceStorage.close(),
          () => workspace.telemetry?.close(),
        ]) {
          try {
            await step();
          } catch {
            process.emitWarning(
              "A shutdown cleanup failed; continuing to close remaining resources.",
            );
          }
        }
      })();
    });
}
