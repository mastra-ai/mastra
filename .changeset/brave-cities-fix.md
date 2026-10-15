---
'@mastra/factory': patch
---

Added `scope=user` to `GET /web/config/models` to list models supported by the caller's personal credentials. Organization-only models are excluded from this personal catalog.
