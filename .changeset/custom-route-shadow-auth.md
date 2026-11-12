---
'@mastra/server': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/elysia': patch
---

Fixed auth checks for custom API routes so they always follow the route that actually handles the request. Previously, overlapping routes, letter case, `HEAD` requests or percent-encoded paths could make auth check a different route than the one that ran, so a protected route could run without auth (for example, a `HEAD` request to a protected `GET` route, or `/%61dmin` for a protected `/admin`).

Requests are now matched the way the custom route handler matches them: the first registered route that matches wins, paths are case-sensitive, trailing slashes count, and `HEAD` uses the `GET` route. Auth, permission and FGA checks use that route and its path params. If a path is registered as protected, or no custom route matches, it is not treated as public.
