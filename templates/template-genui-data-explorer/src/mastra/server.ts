import { registerApiRoute } from "@mastra/core/server";
import type { Config } from "@mastra/core/mastra";
import { workspaceRuntime } from "../workspace/runtime.ts";
import type { WorkspaceEngine } from "../workspace/engine.ts";
import { renderAckSchema } from "../workspace/contracts.ts";

const maximumBody = 2 * 1024 * 1024;
async function boundedBody(request: Request) {
  if (Number(request.headers.get("content-length")) > maximumBody) return;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(5000)]);
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      signal.throwIfAborted();
      if (next.done) return Buffer.concat(chunks).toString("utf8");
      bytes += next.value.byteLength;
      if (bytes > maximumBody) {
        cancel();
        return;
      }
      chunks.push(next.value);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}
const studioPages = /^\/(?:agents|tools|workflows|observability)(?:\/[^/.]+)*\/?$/;
const discovery =
  /^\/api\/(?:agents(?:\/[^/]+(?:\/tools)?)?|tools(?:\/[^/]+)?|workflows(?:\/[^/]+)?|observability(?:\/.*)?|telemetry(?:\/.*)?|studio-config|system\/(?:version|capabilities))\/?$/;
/** Native execution/memory APIs cannot bypass the canonical workspace authority. */
export function nativeServer(
  engine: WorkspaceEngine,
  ports: { agentPort: number; webPort: number },
): NonNullable<Config["server"]> {
  const runtime = workspaceRuntime(engine);
  const hosts = [`127.0.0.1:${ports.agentPort}`, `localhost:${ports.agentPort}`];
  const origins = [
    ...hosts.map((host) => `http://${host}`),
    `http://127.0.0.1:${ports.webPort}`,
    `http://localhost:${ports.webPort}`,
  ];
  return {
    host: "127.0.0.1",
    port: ports.agentPort,
    cors: false,
    bodySizeLimit: maximumBody,
    timeout: 65_000,
    middleware: async (context, next) => {
      const host = context.req.header("host");
      const origin = context.req.header("origin");
      if (!host || !hosts.includes(host) || (origin && !origins.includes(origin)))
        return context.json({ error: "Only local workspace requests are accepted." }, 403);
      const path = context.req.path,
        method = context.req.method;
      const protectedWorkspace =
        (path === "/workspace" && method === "GET") ||
        (path === "/render-ack" && method === "POST") ||
        (path.startsWith("/copilotkit/") && ["GET", "POST"].includes(method));
      if (
        protectedWorkspace ||
        (method === "GET" &&
          (discovery.test(path) ||
            path === "/" ||
            studioPages.test(path) ||
            path.startsWith("/assets/") ||
            path === "/favicon.ico"))
      ) {
        await next();
        return;
      }
      return context.json(
        {
          error:
            "Native execution and memory writes are disabled. Use the guarded CopilotKit workspace.",
        },
        403,
      );
    },
    apiRoutes: [
      registerApiRoute("/workspace", {
        method: "GET",
        handler: (context) => context.json(engine.snapshot()),
      }),
      registerApiRoute("/render-ack", {
        method: "POST",
        handler: async (context) => {
          try {
            const body = await boundedBody(context.req.raw);
            if (body === undefined)
              return context.json({ error: "Request body exceeds 2 MiB." }, 413);
            engine.acknowledgeRender(renderAckSchema.parse(JSON.parse(body)));
            return new Response(undefined, { status: 204 });
          } catch {
            return context.json({ error: "A current saved verified view is required." }, 400);
          }
        },
      }),
      registerApiRoute("/copilotkit/*", {
        method: "ALL",
        handler: async (context) => {
          const request = context.req.raw;
          if (request.method !== "POST") return runtime(request);
          try {
            const body = await boundedBody(request);
            if (body === undefined)
              return context.json({ error: "Request body exceeds 2 MiB." }, 413);
            return runtime(
              new Request(request.url, {
                method: request.method,
                headers: request.headers,
                body,
                signal: request.signal,
              }),
            );
          } catch {
            return context.json(
              { error: "Request upload timed out or was cancelled. Retry explicitly." },
              408,
            );
          }
        },
      }),
    ],
  };
}
