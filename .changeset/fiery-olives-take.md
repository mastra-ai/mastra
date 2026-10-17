---
'@mastra/server': patch
---

Fixed agent observation streams to close on completion and wrapped terminal events, and release subscriptions when replay or cancellation ends the stream during setup.
