---
'@mastra/core': patch
---

Fixed agent runs that hit `modelSettings.timeout.totalMs` losing the user's message from memory. The default and filesystem engines now save the accepted user message when the deadline is reached, as the durable and evented engines already did. Read-only memory is respected.
