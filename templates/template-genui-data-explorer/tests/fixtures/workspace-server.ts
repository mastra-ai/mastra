import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { referenceFixture } from "./reference.ts";
import { workspaceModel } from "./workspace-model.ts";
import { createWorkspace } from "../../src/workspace/create.ts";
process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
const { workspaceServer } = await import("../../src/workspace/server.ts");
import { SalesSource } from "../../data-sources/sales/source.ts";
import { components } from "../../src/ui/catalog.ts";

const directory = process.env.TEST_DIRECTORY;
if (!directory) throw new Error("A test directory is required.");
const salesPath = join(directory, "sales.sqlite");
if (!existsSync(salesPath)) {
  const fixture = referenceFixture(salesPath);
  fixture.db.exec(
    "INSERT INTO opportunities VALUES (6,2,'2025-01-01'); INSERT INTO opportunity_history VALUES (6,'2025-03-15','won',6000,'2025-03-15',2,'Enterprise');",
  );
  fixture.db.close();
}
let calls = 0;
writeFileSync(join(directory, "calls.json"), "0");
const provider = workspaceModel({
  delayMs: 2500,
  invalid: process.env.INVALID_COMPOSITION === "true",
  schemaDriven: process.env.ALTERNATIVE_GROUPING === "true",
  ...(process.env.CUSTOM_COMPONENT === "true" ? { component: "compact" } : {}),
  onCall: (call) => {
    writeFileSync(join(directory, "prompt.json"), JSON.stringify(call.prompt));
    writeFileSync(join(directory, "calls.json"), String(++calls));
  },
});
const catalog = components.map((entry) => ({
  ...entry,
  enabled:
    entry.id === "compact"
      ? process.env.CUSTOM_COMPONENT === "true"
      : entry.enabled && !(entry.id === "line" && process.env.DISABLE_LINE === "true"),
  version: entry.id === "line" && process.env.CHANGE_LINE === "true" ? "2" : entry.version,
  defaults: { pageSize: 2 },
}));
const alternative = process.env.ALTERNATIVE_GROUPING === "true";
const source = alternative ? new SalesSource(salesPath) : undefined;
const app = await createWorkspace({
  ...(source
    ? {
        registrations: [
          {
            id: source.describe().id,
            open: () => ({
              describe: () => source.describe(),
              close: () => source.close(),
              execute: async (
                request: import("../../data-sources/source.ts").AnalysisRequest,
                context?: import("../../data-sources/source.ts").SourceExecutionContext,
              ) => {
                const result = await source.execute(request, context);
                if (result.table && result.table.kind !== "records") {
                  result.table.grouping = "calendarTick";
                  result.table.columns = result.table.columns.map((column) =>
                    column.key === "label" ? { ...column, key: "calendarTick" } : column,
                  );
                  result.table.rows = result.table.rows.map(({ label, ...row }) => ({
                    calendarTick: label ?? null,
                    ...row,
                  }));
                }
                return result;
              },
            }),
          },
        ],
      }
    : {}),
  settings: { path: salesPath },
  workspacePath: join(directory, "workspace.sqlite"),
  memoryPath: join(directory, "memory.sqlite"),
  model: provider.model,
  catalog,
});
const server = workspaceServer(app.engine, { agentPort: 4112, webPort: 3100 });
server.listen(4112, "127.0.0.1", () => console.log("WORKSPACE_READY"));
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    server.close(() => {
      void app.engine.close().finally(() => app.storage.close());
    });
    server.closeAllConnections();
  });
