---
'@mastra/ai-sdk': patch
---

Mapped the new `tool-call-resumed` chunk to a `data-tool-call-suspended` part (or `data-tool-call-approval` part for approvals) with `resumed: true` and the same id. The part keeps the original suspend payload, args, and resume schema, so UIs mark the question as answered in place without losing it.
