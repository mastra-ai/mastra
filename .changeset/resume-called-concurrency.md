---
'@mastra/core': patch
---

Fixed `resumeStream` running resumed tool calls one at a time under `toolCallConcurrency: { strategy: 'called' }`. Parallel-safe tool calls that paused together, such as sub-agent delegations, now resume in parallel. If one call pauses again, its siblings still continue.
