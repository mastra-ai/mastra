---
'@mastra/core': patch
---

Added `timeToFirstChunkMs` (time to first chunk, in milliseconds) to the agent run, model generation and model inference span attributes. The agent run span copies the value from its first model generation, so the root span of an agent trace now carries it. Durable and evented agents now report it on the generation span too.
