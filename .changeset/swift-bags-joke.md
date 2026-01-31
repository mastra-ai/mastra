---
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/core': patch
---

Improved workspace filesystem error handling: return 404 for not-found errors instead of 500, show user-friendly error messages in UI, and add MastraClientError class with status/body properties for better error handling
