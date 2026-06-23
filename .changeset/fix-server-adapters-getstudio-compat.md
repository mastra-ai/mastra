---
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
---

Fix crash on every request when deployed with `@mastra/core` < 1.42.0. The fastify, hono, and koa server adapters called `this.mastra.getStudio()` non-optionally during RBAC pre-checks. On older core versions that method doesn't exist on the `Mastra` class, so every request threw `TypeError: this.mastra.getStudio is not a function` and returned a 500 — even for projects with no auth configured. The call site now uses optional chaining (`getStudio?.()`), matching the pattern already applied in `@mastra/server` (#18075), and the adapters gracefully fall back to server-only auth.
