---
'@mastra/server': minor
---

Added ownership and visibility enforcement to agent and skill routes.

**Agents:** `GET /agents` returns the caller's stored agents plus all code-defined agents by default. Use `?authorId=X` to see a specific user's public agents, or `?visibility=public` to list all public stored agents. `GET /agents/:agentId` returns 404 for stored agents the caller cannot read. `POST /agents/:agentId/clone` forces the clone's `authorId` to the caller and marks it private.

**Stored agents & skills:** `CREATE` injects the caller's `authorId` automatically. `UPDATE` and `DELETE` are blocked for non-owners (admins can bypass). `LIST` returns owned + public resources for regular users, and all resources for admins.
