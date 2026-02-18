---
'@mastra/client-js': patch
---

Fix agent losing conversation context ("amnesia") when using client-side tools with stateless server deployments. Recursive calls after tool execution now include the full conversation history when no `threadId` is provided.
