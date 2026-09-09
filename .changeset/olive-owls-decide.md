---
'@mastra/client-js': minor
'@mastra/deployer': patch
'@mastra/server': patch
'@mastra/core': patch
---

Added an optional exact thread to the native client Session handle. Use controller.session(resourceId, scope, { threadId }) with a compatible server to keep reads, streams, approvals and Stop attached to that thread after restart.
