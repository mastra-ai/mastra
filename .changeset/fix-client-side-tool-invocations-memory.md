---
'@mastra/core': patch
---

Fixed client-side tool invocations not being stored in memory. Previously, tool invocations with state 'call' were filtered out before persistence, which incorrectly removed client-side tools (tools without an execute function on the server). Now only streaming intermediate states ('partial-call') are filtered, preserving client-side tool invocations in the conversation history.
