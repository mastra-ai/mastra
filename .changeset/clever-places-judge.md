---
'@mastra/server': patch
'@mastra/core': patch
---

Fixed invalid workflow input responses to return HTTP 400 instead of HTTP 500 while preserving schema validation details.
