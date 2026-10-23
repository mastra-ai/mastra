---
'@mastra/server': patch
'@mastra/hono': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/koa': patch
'@mastra/elysia': patch
'@mastra/nestjs': patch
---

Fixed dataset schema updates showing "0 items fail validation" in Studio on Express, Fastify, Koa, Elysia and NestJS servers. When existing items no longer match a new dataset schema, every server adapter now returns those items in the `400` response body under `cause.failingItems`. Before this fix, only Hono did. No other error `cause` is sent to clients.
