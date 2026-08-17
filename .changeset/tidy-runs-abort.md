---
'@mastra/core': patch
---

Fixed observed durable run cancellation so calling `cleanup()` immediately after `abort()` no longer removes run state before terminal events and lifecycle callbacks are delivered.

Related to https://github.com/mastra-ai/mastra/issues/21522
