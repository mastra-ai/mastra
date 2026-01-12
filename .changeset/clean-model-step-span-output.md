---
"@mastra/observability": patch
---

Clean up model_step span output for better observability. Tools are now serialized with only essential fields (type, id, description, inputSchema, outputSchema) instead of full objects with Zod internals.
