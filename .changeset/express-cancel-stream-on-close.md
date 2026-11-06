---
'@mastra/express': patch
---

Streaming routes now stop reading the response stream when the client disconnects, matching the Hono and Fastify adapters. Before, Express read every dropped stream to the end, and for durable or evented agents on `untilIdle` routes, `/observe` returned 404 "Run not found" right after the client dropped. Replaying a run after a disconnect now works on Express.
