---
'@mastra/deployer': patch
'@mastra/core': patch
---

Fixed stopping a saved durable run after a restart so it saves the abort result and completed usage. Reuse native recovery ownership to reject competing restoration, preserve later runs on the same thread, and finish accepted cancellation before shutdown.
