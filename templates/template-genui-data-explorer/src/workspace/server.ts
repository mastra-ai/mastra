import { createServer } from "node:http";
import { workspaceRuntime } from "./runtime.ts";
import type { WorkspaceEngine } from "./engine.ts";

export function workspaceServer(
  engine: WorkspaceEngine,
  options: { agentPort: number; webPort: number },
) {
  const handler = workspaceRuntime(engine);
  const hosts = [`127.0.0.1:${options.agentPort}`, `localhost:${options.agentPort}`];
  const origins = [
    ...hosts.map((host) => `http://${host}`),
    `http://127.0.0.1:${options.webPort}`,
    `http://localhost:${options.webPort}`,
  ];
  const server = createServer(async (request, response) => {
    const controller = new AbortController();
    response.on("close", () => {
      if (!response.writableEnded) controller.abort();
    });
    const host = request.headers.host;
    const origin = request.headers.origin;
    if (!host || !hosts.includes(host) || (origin && !origins.includes(origin))) {
      response.writeHead(403);
      response.end("Only local workspace requests are accepted.");
      return;
    }
    if (request.url === "/workspace" && request.method === "GET") {
      try {
        const snapshot = engine.snapshot();
        response.writeHead(200, {
          "content-type": "application/json",
          "cache-control": "no-store",
        });
        response.end(JSON.stringify(snapshot));
      } catch {
        response.writeHead(503, {
          "content-type": "application/json",
          "cache-control": "no-store",
        });
        response.end(
          JSON.stringify({
            error: "Saved workspace could not be read. Restore a compatible local store.",
          }),
        );
      }
      return;
    }
    if (
      !request.url?.startsWith("/copilotkit/") ||
      !["GET", "POST"].includes(request.method ?? "")
    ) {
      response.writeHead(404);
      response.end();
      return;
    }
    let bytes = 0;
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      controller.abort();
      request.destroy();
    }, 5000);
    try {
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 2 * 1024 * 1024) {
          response.writeHead(413);
          response.end("Request too large.");
          request.destroy();
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      clearTimeout(timer);
      const body = Buffer.concat(chunks).toString("utf8");
      const result = await handler(
        new Request(`http://${host}${request.url}`, {
          method: request.method ?? "GET",
          headers: { "content-type": "application/json" },
          ...(body ? { body } : {}),
          signal: controller.signal,
        }),
      );
      response.writeHead(result.status, {
        "content-type": result.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      });
      if (result.body) {
        const reader = result.body.getReader();
        try {
          while (!controller.signal.aborted) {
            const chunk = await reader.read();
            if (chunk.done) break;
            if (!response.destroyed) response.write(chunk.value);
          }
        } finally {
          await reader.cancel();
          reader.releaseLock();
        }
      }
      if (!response.destroyed) response.end();
    } catch {
      if (!response.headersSent) response.writeHead(400, { "content-type": "application/json" });
      if (!response.destroyed)
        response.end(JSON.stringify({ error: "Invalid local request. Reload and retry." }));
    } finally {
      clearTimeout(timer);
    }
  });
  server.headersTimeout = 5000;
  server.requestTimeout = 5000;
  return server;
}
