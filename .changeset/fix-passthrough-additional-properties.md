---
'@mastra/schema-compat': patch
---

Fix schema validation error when using Zod's .passthrough() or z.looseObject() in vector tools. Normalizes additionalProperties: true/{} to { type: 'any' } for AI SDK validator compatibility.
