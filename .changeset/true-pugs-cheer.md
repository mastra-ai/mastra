---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/playground-ui': patch
'@mastra/elysia': patch
'@mastra/nestjs': patch
'@mastra/client-js': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/react': patch
'@mastra/deployer': patch
'@mastra/editor': patch
'@mastra/server': patch
'@mastra/core': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/mysql': patch
'@mastra/turso': patch
'@mastra/pg': patch
---

Fixed typed API error responses being collapsed into a plain message. Errors that carry a structured envelope — such as version-label conflicts (LABEL_MOVE_CONFLICT) and unsupported-storage responses (VERSION_LABELS_UNSUPPORTED) — now reach clients with their `{ error: { code, message, details } }` body intact.
