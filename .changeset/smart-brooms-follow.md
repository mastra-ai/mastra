---
'@mastra/core': patch
---

Fixed durable agents dropping custom `resumeData` on tool approval. When a caller approves a tool call with extra keys, for example `sendToolApproval({ approved: true, resumeData: { approved: true, note: 'hello' } })`, the durable agent now forwards that payload to the tool's `execute` through `context.agent.resumeData`, matching the non-durable agent. A bare `{ approved: true }` is still not forwarded. Fixes https://github.com/mastra-ai/mastra/issues/24561
