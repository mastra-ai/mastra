---
'@mastra/inngest': patch
---

Fixed Inngest durable agents running the wrong tool when two tool calls are waiting for approval. Approving one call now runs only that call and leaves the other one waiting. Approving both, in any order or at the same time, now runs each tool once and returns the final answer once instead of twice.
