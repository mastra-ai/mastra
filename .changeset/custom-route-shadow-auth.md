---
'@mastra/server': patch
'@mastra/fastify': patch
---

Fixed custom API route auth when two routes overlap. If a protected route like `/admin/:id` was registered before a public `/admin/public`, requests to `/admin/public` were served by the protected handler without any auth check. Auth and FGA checks now follow the route that actually handles the request, including its path params.
