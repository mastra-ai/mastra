---
'@mastra/core': patch
---

Fix DurableAgent + ToolSearchProcessor loop where tools auto-loaded by `search_tools` were not preserved across durable steps (#22933). The durable LLM step now keeps the full resolved tool catalog on `registryEntry.tools` and stores only the per-step narrowed snapshot on `registryEntry.stepTools`, so tools loaded on one step remain available on the next.
