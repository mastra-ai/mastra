---
'@mastra/core': patch
---

Fixed sub-agents that stopped streaming after a durable agent run was resumed with a `requestContext`. A run started with `stream()` now keeps streaming its sub-agents' progress after `resume()`, `resumeStream()` or `approveToolCall()`, also when `closeOnSuspend` is set. Fixes [#29436](https://github.com/mastra-ai/mastra/issues/29436).
