---
'@mastra/server': patch
'@mastra/core': patch
---

Fixed thread authorization checks to preserve the authenticated user context and hide threads the user cannot access from memory listings.
