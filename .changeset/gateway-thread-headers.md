---
"@mastra/core": patch
---

Inject x-thread-id and x-resource-id headers on outbound LLM calls when threadId/resourceId are present in the agent execution context, enabling server-side memory enrichment via Memory Gateway
