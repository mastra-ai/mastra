---
'@mastra/core': patch
---

Fixed `resumeStream` running resumed tool calls one at a time under `toolCallConcurrency: { strategy: 'called' }`. When several parallel-safe tool calls (for example sub-agent delegations) suspended together and were resumed without a `toolCallId`, the resumed calls fell back to a concurrency of 1, and a call that suspended again prevented its queued siblings from continuing. Resumed batches now use the same concurrency limit as the original run.
