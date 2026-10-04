import { createServer } from "node:http";
import type { DataExplorer } from "./explorer.ts";

/** Local JSON transport. Host and Origin checks protect the server-owned provider credential. */
export function analysisServer(explorer: DataExplorer) {
  const server = createServer(async (request, response) => {
    const address = server.address();
    const port = address && typeof address !== "string" ? address.port : 0;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    const host = request.headers.host;
    const origin = request.headers.origin;
    if (
      !host ||
      !hosts.includes(host) ||
      (origin !== undefined && !hosts.some((allowed) => origin === `http://${allowed}`))
    ) {
      response.writeHead(403).end("Use the local explorer origin.");
      return;
    }
    if (request.method !== "POST" || request.url !== "/analysis") {
      response.writeHead(404).end();
      return;
    }
    if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers["content-type"] ?? "")) {
      response.writeHead(415).end("Send application/json.");
      return;
    }
    const controller = new AbortController();
    const bodyTimer = setTimeout(() => {
      if (!response.headersSent) response.writeHead(408).end("Question upload timed out.");
      request.destroy();
    }, 5000);
    response.once("close", () => {
      clearTimeout(bodyTimer);
      if (!response.writableEnded) controller.abort();
    });
    try {
      let body = "";
      for await (const chunk of request) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 65536) {
          response.writeHead(413).end("Question payload too large.");
          return;
        }
      }
      clearTimeout(bodyTimer);
      const input: unknown = JSON.parse(body);
      response.writeHead(200, {
        "content-type": "application/x-ndjson",
        "cache-control": "no-store",
      });
      for await (const event of explorer.stream(input, { signal: controller.signal })) {
        if (!response.destroyed) response.write(`${JSON.stringify(event)}\n`);
      }
      response.end();
    } catch {
      if (!response.headersSent) response.writeHead(400, { "content-type": "application/json" });
      if (!response.destroyed)
        response.end(
          JSON.stringify({ error: "Invalid analysis request. Send valid JSON and retry." }),
        );
    } finally {
      clearTimeout(bodyTimer);
    }
  });
  server.headersTimeout = 5000;
  server.requestTimeout = 5000;
  return server;
}
