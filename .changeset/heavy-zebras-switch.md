---
'@mastra/core': patch
---

Fixed a durable agent run losing the user's message when the process died right after the message was saved to memory. The run is now saved as recoverable before the message is stored, so recovery picks it up and answers the message instead of leaving it unanswered in the thread. Fixes #30791.
