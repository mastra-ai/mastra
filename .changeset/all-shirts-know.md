---
'@mastra/hono': patch
'@mastra/server': patch
'@mastra/core': patch
---

Fixed a regression in 1.29.0 where configuring an agent with channel adapters (e.g. `channels.adapters.slack`) caused server startup to crash with a "Custom API route ... must not start with /api" error. The custom-route prefix validation now skips framework-generated webhook routes.
