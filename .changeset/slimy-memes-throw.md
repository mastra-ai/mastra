---
'@mastra/factory': patch
---

Added `owner` to the session model catalog (`GET /web/config/models?resourceId=…&threadId=…`): for each model provider, whether the credential answering the thread is an API key or which subscription it bills, such as "Claude Pro/Max" or "SuperGrok/X Premium+". Whose credential it is follows `modelScope`: the organization's, or the session owner's as `GET /web/user-sessions/:sessionId` already names them.
