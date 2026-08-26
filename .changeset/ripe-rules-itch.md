---
'@mastra/core': patch
---

Fixed `step-start` stream chunks carrying no timestamp by adding an optional `startedAt` field (epoch milliseconds) to the payload. The timestamp is captured right before the model provider is called, so time to first token can now be measured accurately — including for durable agents, where the `step-start` chunk is delivered only after the model has already produced output and previously made time to first token appear as zero. Fixes https://github.com/mastra-ai/mastra/issues/22323
