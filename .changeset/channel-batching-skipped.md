---
"@mastra/core": patch
---

Fixed channel messages being dropped when `chatOptions.concurrency` uses `burst`, `debounce`, or `queue`. Messages the Chat SDK batches together now reach the agent as one turn, oldest first, and are saved to memory. Custom channel handlers can read the batched messages from `context.skipped`. Fixes [#22496](https://github.com/mastra-ai/mastra/issues/22496).
