---
'@mastra/core': minor
---

Added `subagentHistory` to `HarnessDisplayState` so UIs can keep rendering completed, errored, and aborted subagent runs after `agent_end`.

Use `harness.getDisplayState().subagentHistory` to read the retained subagent activity, including `toolCallId`, `endedAt`, `order`, and `parentEndReason`. Closes #16056.
