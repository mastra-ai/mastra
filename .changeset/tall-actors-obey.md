---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/server': patch
---

Types are now imported from @mastra/server/schemas instead of being defined locally via Zod inference. No changes to the public API.
