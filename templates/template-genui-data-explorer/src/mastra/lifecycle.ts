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
        await observability.shutdown();
        await workspace.engine.close();
        await workspace.storage.close();
        await traceStorage.close();
        workspace.telemetry?.close();
      })();
    });
}
