---
'@mastra/schema-compat': patch
---

Handle null types in MCP tool schemas for Anthropic and OpenAI Reasoning providers

MCP servers that use `{ "type": "null" }` in their tool schemas no longer crash on startup. Previously, null types in tool schemas caused a fatal error when used with Claude or OpenAI reasoning models. The null type is now coerced to a compatible representation so these tools load and work correctly.
