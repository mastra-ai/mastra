---
'@mastra/hono': patch
'@mastra/server': patch
'@mastra/next': patch
'@mastra/tanstack-start': patch
---

Fixed `server.middleware` and middleware added via `mastra.setServerMiddleware()` being silently ignored when Mastra is served through a server adapter instead of `mastra dev` / `mastra build`.

Hono-based adapters (`@mastra/hono`, and `@mastra/next` / `@mastra/tanstack-start` which build on it) now register the configured middleware during `init()`, with the same guarantee as the built-in server: user middleware never runs on routes declared public with `requiresAuth: false`. Adapters for other frameworks (Express, Fastify, Koa) cannot run Hono middleware handlers and now log a warning at startup instead of silently ignoring the configuration.

Also fixed custom routes with `requiresAuth: false` not being treated as framework-public when the adapter derives its route auth configuration from the Mastra instance instead of receiving it in the constructor.

Fixes https://github.com/mastra-ai/mastra/issues/21869
