---
'@mastra/server': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/editor': patch
'@mastra/core': patch
---

Added visibility and ownership enforcement to `/agents` routes. `GET /agents` now returns the caller's stored agents plus all code-defined agents by default. Use `?authorId=X` to see X's public agents or `?visibility=public` to aggregate every public stored agent. `GET /agents/:agentId` returns 404 for stored agents the caller cannot read (owner, admin, scoped `agents:read:<id>`, or `visibility: 'public'`). `POST /agents/:agentId/clone` now forces the new clone's `authorId` to the caller and marks it private.
