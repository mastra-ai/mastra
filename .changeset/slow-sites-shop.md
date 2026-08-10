---
'@mastra/schema-compat': patch
---

Fixed exponentially large OpenAI tool payloads for nested JSON Schema optional properties. Optional properties — both single-type and multi-type `type` arrays (common in MCP and other external JSON Schema tools) — no longer duplicate their nested subtrees when promoted to nullable anyOf; type-specific keywords now move only into the branch of their matching type, while shared annotations stay once on the property.
