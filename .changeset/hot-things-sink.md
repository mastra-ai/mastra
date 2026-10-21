---
'@mastra/code-sdk': patch
---

Fixed "build a workflow" requests never finishing in Mastra Code. The workflow builder no longer inherits the chat session's memory thread, so it stops waiting on the session run that is waiting on it.
