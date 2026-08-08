---
'@mastra/schema-compat': patch
---

Fixed validation failure when Google, Anthropic, DeepSeek, and Meta providers received null for .optional() or .default() fields. These providers now convert null to undefined for optional fields and apply default values, matching the existing OpenAI behavior.
