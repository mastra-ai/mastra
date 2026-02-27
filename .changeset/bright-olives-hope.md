---
'@mastra/schema-compat': patch
---

Added ZodIntersection support so that MCP tools using allOf in their JSON Schema no longer throw 'does not support zod type: ZodIntersection'. Intersection types are flattened and merged into a single object schema across all provider compatibility layers (Anthropic, Google, OpenAI, OpenAI Reasoning, DeepSeek, Meta).
