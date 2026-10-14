---
'@mastra/schema-compat': patch
---

Fixed two OpenAI strict-mode schema gaps:

- Optional `anyOf` properties in plain JSON Schema tools (for example from MCP servers) now accept `null`, so models can leave them unset instead of inventing a value.
- `z.record()` fields no longer send `propertyNames`, which OpenAI strict structured output rejects with a 400.
