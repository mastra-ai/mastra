---
'@mastra/server': patch
---

Fixed observational memory routes for gateway agents so users can't read each other's observations. `GET /api/memory/observational-memory`, `POST /api/memory/observational-memory/buffer-status`, and the observational memory details in `GET /api/memory/status` now check that the requested gateway thread belongs to the caller's resource and pass any FGA check (403 otherwise), use the server-resolved resource and thread IDs, and return no observations for a thread that no longer exists. As on the other memory routes, the caller's resource comes from `mapUserToResourceId` when it is configured; signing in alone does not tie a request to a resource. `GET /api/memory/status` stays best-effort when the gateway thread lookup fails. Without auth, the `resourceId` and `threadId` sent by the client are still used, but a request that pairs a thread with a different `resourceId` now gets 403, as it already does for local memory.
