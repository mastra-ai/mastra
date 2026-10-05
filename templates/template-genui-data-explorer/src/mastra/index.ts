import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { localObservability } from "../observability/native.ts";
import { runtimeConfiguration } from "./configuration.ts";
import { resolve } from "node:path";
import { createWorkspace } from "../workspace/create.ts";
import { nativeServer } from "./server.ts";

const directory = resolve(
  process.env.TEMPLATE_DIRECTORY ?? process.cwd(),
  process.env.DATA_DIRECTORY ?? ".data",
);
const traceStorage = new LibSQLStore({
  id: "local-traces",
  url: `file:${resolve(directory, "traces.sqlite")}`,
});
await traceStorage.init();
const observability = localObservability();
export const mastra = new Mastra({ storage: traceStorage, observability, logger: false });
const app = await createWorkspace({
  mastra,
  ...runtimeConfiguration(),
  settings: { path: resolve(directory, "sales.sqlite") },
  workspacePath: resolve(directory, "workspace.sqlite"),
  memoryPath: resolve(directory, "memory.sqlite"),
  telemetryPath: resolve(directory, "telemetry.sqlite"),
  model: {
    providerId: "openai",
    modelId: process.env.ANALYSIS_MODEL ?? "gpt-4.1-mini",
    ...(process.env.ANALYSIS_BASE_URL
      ? { url: process.env.ANALYSIS_BASE_URL, api: "chat" as const }
      : {}),
  },
});
mastra.setServer(
  nativeServer(app.engine, {
    agentPort: Number(process.env.AGENT_PORT ?? 4111),
    webPort: Number(process.env.WEB_PORT ?? 3000),
  }),
);
let closing: Promise<void> | undefined;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    closing ??= (async () => {
      await observability.shutdown();
      await app.engine.close();
      await app.storage.close();
      await traceStorage.close();
      app.telemetry?.close();
    })();
  });
