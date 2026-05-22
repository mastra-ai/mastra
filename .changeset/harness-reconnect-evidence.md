---
'@mastra/core': patch
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/nestjs': patch
---

Add Harness v1 inbox-response result lookup evidence for reconnect recovery, expose the route in generated client route types, add the client-js `harnesses` / `RemoteSession` resource for the remote Harness contract, forward request header lookups through server adapters for Last-Event-ID and If-Match recovery semantics, emit a once-per-session event when workspace action journaling is unavailable, and harden Harness SSE replay with bounded replay/live dedupe plus page keepalives.
