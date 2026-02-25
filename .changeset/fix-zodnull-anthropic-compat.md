---
'@mastra/schema-compat': patch
---

Fix `ZodNull` throwing "does not support zod type: ZodNull" for Anthropic and OpenAI reasoning models. MCP tools with nullable properties in their JSON Schema produce `z.null()` which was unhandled by these provider compat layers.
