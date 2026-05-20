---
'@mastra/server': patch
---

Align stored-entity authorship checks with their RBAC resource names. Stored-agent and stored-skill handlers were calling `hasAdminBypass` / `assertReadAccess` / `assertWriteAccess` / `resolveAuthorFilter` with `resource: 'agents'` and `resource: 'skills'`, but the routes are gated by `stored-agents:*` / `stored-skills:*` permissions. An admin granted `stored-agents:*` (or `stored-skills:*`) without the global `*` wildcard would pass route authorization but be treated as a non-admin inside the handler, so they could not list, read, or update private records owned by other users. Handlers now use `stored-agents` and `stored-skills` as the authorship resource string, matching the permission strings emitted by the route layer.
