---
'@mastra/core': patch
---

Fixed sub-agents that stopped streaming after a durable agent run was resumed with a `requestContext`. A run started with `stream()` now keeps streaming its sub-agents' progress after `resume()`, `resumeStream()` or `approveToolCall()`, also when `closeOnSuspend` is set.

Tool calls that a delegated sub-agent makes on durable and evented runs report their result again (`subagent_tool_end`), so the agent controller shows whether each one succeeded or failed instead of leaving it without a status. Fixes [#29436](https://github.com/mastra-ai/mastra/issues/29436).
