---
'@mastra/server': patch
'@mastra/elysia': patch
'@mastra/koa': patch
---

Agent generate and stream routes now respond with HTTP 400 instead of 500 when the request context fails the agent's `requestContextSchema`. This applies to regular and durable agents, so clients and monitors no longer treat a bad request as a server failure.

The Elysia and Koa adapters no longer log 4xx client errors as server errors, matching the Hono, Express, and Fastify adapters.
