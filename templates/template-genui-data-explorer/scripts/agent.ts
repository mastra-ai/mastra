import { resolve } from "node:path";
process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
const { createWorkspace } = await import("../src/workspace/create.ts");
const { workspaceServer } = await import("../src/workspace/server.ts");
const directory = resolve(process.env.DATA_DIRECTORY ?? ".data");
const agentPort = Number(process.env.AGENT_PORT ?? 4111),
  webPort = Number(process.env.WEB_PORT ?? 3000);
const app = await createWorkspace({
  settings: { path: resolve(directory, "sales.sqlite") },
  workspacePath: resolve(directory, "workspace.sqlite"),
  memoryPath: resolve(directory, "memory.sqlite"),
});
const server = workspaceServer(app.engine, { agentPort, webPort });
server.on("error", () => {
  console.error("The agent port is unavailable. Set AGENT_PORT to an unused local port and retry.");
  void app.engine.close().finally(() => app.storage.close());
  process.exitCode = 1;
});
server.listen(agentPort, "127.0.0.1", () => console.log(`Local agent ready on ${agentPort}`));
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    server.close(() => {
      void app.engine.close().finally(() => app.storage.close());
    });
    server.closeAllConnections();
  });
