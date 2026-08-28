---
'@mastra/factory': minor
---

Work item comment feeds now update over a project-scoped SSE stream at `GET /web/factory/projects/:id/feed-events`, published through the configured pubsub so a comment written on one replica reaches streams held by another. Clients fall back to polling only while the stream is down.
