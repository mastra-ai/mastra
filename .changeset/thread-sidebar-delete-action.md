---
'@internal/playground': patch
---

Fixed the thread sidebar on the standalone agent chat page (`/agents/:agentId/threads/:threadId`) in Studio missing the delete action for saved threads. Hovering a thread row now reveals a delete button again, with a confirmation dialog before the thread is removed. Deleting the thread you are currently viewing redirects to a new chat. Fixes [#22763](https://github.com/mastra-ai/mastra/issues/22763).
