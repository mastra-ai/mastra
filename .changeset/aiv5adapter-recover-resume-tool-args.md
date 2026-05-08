---
'@mastra/core': patch
---

Fixed an issue where resumed agent runs could lose the original tool-call arguments when a tool result arrived in a separate message — for example, after `agent.resumeStream(...)` from a human-in-the-loop suspend.

Agents now recover prior tool-call arguments from earlier messages, so resumed runs preserve a valid tool invocation history.

Fixes #16017.
