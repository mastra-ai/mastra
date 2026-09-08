---
'@mastra/server': patch
---

Fixed `GET /agents/:agentId` returning a 500 for agents whose dynamic instructions, tools, model, or options resolvers throw when called without execution context (for example a model selected per session). Unresolved fields are now omitted from the response, matching the behaviour of `GET /agents`, so these agents open correctly in Studio. Fixes https://github.com/mastra-ai/mastra/issues/23126
