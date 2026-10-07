import { maximumBody, boundedBody } from "../server/http.ts";
import { deployment, authorizedProxy } from "../server/deployment.ts";
import { z } from "zod";
import { registerApiRoute } from "@mastra/core/server";
import type { Config } from "@mastra/core/mastra";
import { workspaceRuntime } from "../workspace/runtime.ts";
import type { WorkspaceEngine } from "../workspace/engine.ts";
import { renderAckSchema, requestedSession } from "../workspace/contracts.ts";

const studioPages = /^\/(?:agents|tools|workflows|observability)(?:\/[^/.]+)*\/?$/;
const discovery =
  /^\/api\/(?:agents(?:\/[^/]+(?:\/tools)?)?|tools(?:\/[^/]+)?|workflows(?:\/[^/]+)?|observability(?:\/.*)?|telemetry(?:\/.*)?|studio-config|system\/(?:version|capabilities))\/?$/;
/** Native execution/memory APIs cannot bypass the canonical workspace authority. */
export function nativeServer(
  engine: WorkspaceEngine,
  ports: { agentPort: number; webPort: number },
): NonNullable<Config["server"]> {
  const runtime = workspaceRuntime(engine);
  const connection = deployment(ports);
  return {
    host: connection.agentHost,
    port: ports.agentPort,
    cors: false,
    bodySizeLimit: maximumBody,
    timeout: 65_000,
    middleware: async (context, next) => {
      const host = context.req.header("host");
      const origin = context.req.header("origin");
      if (
        !host ||
        !connection.agentHosts.includes(host) ||
        (origin && !connection.origins.includes(origin)) ||
        !authorizedProxy(context.req.raw, connection.token)
      )
        return context.json({ error: "Only authorized workspace requests are accepted." }, 403);
      const path = context.req.path,
        method = context.req.method;
      const protectedWorkspace =
        (path === "/workspace" && method === "GET") ||
        (path === "/render-ack" && method === "POST") ||
        (path === "/sessions" && method === "POST") ||
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
        handler: (context) => {
          try {
            return context.json(engine.snapshot(requestedSession(context.req.raw)));
          } catch {
            return context.json(
              { error: "Saved chat is unavailable. Select a compatible local chat." },
              400,
            );
          }
        },
      }),
      registerApiRoute("/sessions", {
        method: "POST",
        handler: async (context) => {
          try {
            const body = await boundedBody(context.req.raw);
            if (body === undefined)
              return context.json({ error: "Request body exceeds 2 MiB." }, 413);
            z.strictObject({}).parse(JSON.parse(body));
            return context.json(engine.createSession(), 201);
          } catch {
            return context.json(
              { error: "Chat creation failed. Check local storage and retry." },
              400,
            );
          }
        },
      }),
      registerApiRoute("/render-ack", {
        method: "POST",
        handler: async (context) => {
          try {
            const body = await boundedBody(context.req.raw);
            if (body === undefined)
              return context.json({ error: "Request body exceeds 2 MiB." }, 413);
            engine.acknowledgeRender(
              renderAckSchema.parse(JSON.parse(body)),
              requestedSession(context.req.raw),
            );
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
