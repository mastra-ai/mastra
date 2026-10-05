import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { prepareSource, sources, defaultSourceId } from "./sources.ts";

process.env.NEXT_TELEMETRY_DISABLED = "1";
process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
if (!process.env.OPENAI_API_KEY)
  throw new Error(
    "Set OPENAI_API_KEY in .env and retry npm run dev. Credentials stay on the server.",
  );
const agentPort = Number(process.env.AGENT_PORT ?? 4111),
  webPort = Number(process.env.WEB_PORT ?? 3000);
if (
  [agentPort, webPort].some((port) => !Number.isInteger(port) || port < 1 || port > 65535) ||
  agentPort === webPort
)
  throw new Error("AGENT_PORT and WEB_PORT must be distinct valid local ports.");
for (const port of [agentPort, webPort])
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () =>
      reject(
        new Error(`Local port ${port} is unavailable. Correct AGENT_PORT/WEB_PORT and retry.`),
      ),
    );
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve()));
  });
await prepareSource(sources, defaultSourceId, {
  path: resolve(process.env.DATA_DIRECTORY ?? ".data", "sales.sqlite"),
});
const agent = spawn(process.execPath, ["scripts/agent.ts"], {
  stdio: "inherit",
  env: { ...process.env, AGENT_PORT: String(agentPort), WEB_PORT: String(webPort) },
});
const web = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(webPort)],
  {
    stdio: "inherit",
    env: { ...process.env, AGENT_PORT: String(agentPort), WEB_PORT: String(webPort) },
  },
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  agent.kill("SIGTERM");
  web.kill("SIGTERM");
  const timer = setTimeout(() => {
    agent.kill("SIGKILL");
    web.kill("SIGKILL");
  }, 5000);
  timer.unref();
}
for (const child of [agent, web]) {
  child.once("error", () => {
    process.exitCode = 1;
    stop();
  });
  child.once("exit", (code) => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  });
}
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, stop);
