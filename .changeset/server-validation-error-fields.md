---
'@mastra/server': patch
---

Dataset item schema validation errors now tell you which fields failed, on every server adapter (Hono, Express, Fastify, Koa, Elysia, NestJS). Adding or updating an item whose `input` or `groundTruth` doesn't match the dataset schema now returns a `400` whose `cause` lists the failing field paths and their messages. Submitted values are never included.

```json
{
  "error": "Validation failed for input: Invalid input: expected string, received number",
  "cause": { "field": "input", "errors": [{ "path": "/question", "message": "Invalid input: expected string, received number" }] }
}
```
