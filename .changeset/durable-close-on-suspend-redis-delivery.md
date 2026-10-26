---
'@mastra/core': patch
---

Fixed durable agent streams with `closeOnSuspend: true` closing before they deliver their chunks when the agent uses Redis Streams PubSub. For example, the model can request two approval tool calls in one step. If you approve the first with `resumeStream(..., { closeOnSuspend: true })`, the resumed stream now includes the tool result and the second approval request instead of closing empty. Fixes #28479.
