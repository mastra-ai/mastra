import { sourceId } from "../src/mastra/configuration.ts";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { prepareSource, sources } from "./sources.ts";

process.env.NEXT_TELEMETRY_DISABLED = "1";
process.env.MASTRA_TELEMETRY_DISABLED = "true";
process.env.COPILOTKIT_TELEMETRY_DISABLED = "true";
if (!process.env.OPENAI_API_KEY?.trim())
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
await prepareSource(sources, sourceId, {
  path: resolve(process.env.DATA_DIRECTORY ?? ".data", "sales.sqlite"),
});
await new Promise<void>((resolve, reject) => {
  const compiler = spawn(
    process.execPath,
    ["node_modules/typescript/bin/tsc", "-p", "tsconfig.build.json"],
    { stdio: "inherit" },
  );
  compiler.once("error", reject);
  compiler.once("exit", (code) =>
    code === 0
      ? resolve()
      : reject(new Error("Source preparation failed. Run npm run typecheck and retry.")),
  );
});
const production = process.argv.includes("--production");
const agent = spawn(
  process.execPath,
  production
    ? [".mastra/output/index.mjs"]
    : ["node_modules/mastra/dist/index.js", "dev", "--dir", "src/mastra"],
  {
    stdio: "inherit",
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      TEMPLATE_DIRECTORY: process.cwd(),
      AGENT_PORT: String(agentPort),
      WEB_PORT: String(webPort),
      PORT: String(agentPort),
    },
  },
);
const web = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    production ? "start" : "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(webPort),
  ],
  {
    stdio: "inherit",
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      TEMPLATE_DIRECTORY: process.cwd(),
      AGENT_PORT: String(agentPort),
      WEB_PORT: String(webPort),
      PORT: String(agentPort),
    },
  },
);
function terminate(child: ReturnType<typeof spawn>, signal: NodeJS.Signals) {
  if (!child.pid) return;
  try {
    if (process.platform === "win32") child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch {
    /* Already stopped. */
  }
}
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  terminate(agent, "SIGTERM");
  terminate(web, "SIGTERM");
  const timer = setTimeout(() => {
    terminate(agent, "SIGKILL");
    terminate(web, "SIGKILL");
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

async function awaitStartup() {
  const deadline = Date.now() + 60000;
  while (!stopping && Date.now() < deadline) {
    const statuses = await Promise.all(
      [`http://127.0.0.1:${agentPort}/workspace`, `http://127.0.0.1:${webPort}`].map(
        async (url) => {
          try {
            const headers: Record<string, string> = {};
            if (
              url === `http://127.0.0.1:${agentPort}/workspace` &&
              process.env.WORKSPACE_PROXY_TOKEN
            )
              headers["x-workspace-token"] = process.env.WORKSPACE_PROXY_TOKEN;
            const response = await fetch(url, { headers, signal: AbortSignal.timeout(1000) });
            return response.status === 200;
          } catch {
            return false;
          }
        },
      ),
    );
    if (statuses.every(Boolean)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!stopping) {
    console.error(
      "Workspace startup failed. Review the server error above, correct configuration, and retry.",
    );
    process.exitCode = 1;
    stop();
  }
}
void awaitStartup();
