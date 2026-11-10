---
'@mastra/server': patch
---

Fixed observational memory routes for gateway agents so signed-in users can only see their own observations. `GET /memory/observational-memory`, `POST /memory/observational-memory/buffer-status`, and the observational memory details in `GET /memory/status` now check that the requested gateway thread belongs to the signed-in user (403 otherwise), use the server-resolved resource and thread IDs, and return no observations for a thread that no longer exists. `GET /memory/status` stays best-effort when the gateway thread lookup fails. Behavior without auth is unchanged.
