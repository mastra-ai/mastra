---
'@mastra/core': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/editor': patch
'@mastra/server': patch
---

Added `visibility` field to stored agents so owners can publish specific agents to other users. A new stored agent defaults to `private`. Private agents are readable only by their owner (or users with admin/scoped permissions). Setting `visibility: 'public'` on an agent makes it readable by any caller that holds `agents:read`.
