---
'@mastra/core': patch
---

Fixed streaming supervisors that delegate to a durable or evented sub-agent:

- The supervisor now receives the sub-agent's answer instead of a "Failed agent tool execution" error.
- Tool approval requests from the sub-agent now reach the supervisor instead of stalling its stream.
- After an approval or decline, the delegation result points to the sub-agent's own thread and conversation.
- A declined tool call is no longer reported as a tool that never ran.
- Redacted tool-result fields stay redacted when the sub-agent's conversation is saved.

`generate()` was not affected.
