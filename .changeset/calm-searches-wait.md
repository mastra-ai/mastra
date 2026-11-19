---
'@mastra/client-js': patch
---

Fixed observability queries retrying a word search the server stopped for taking too long (504 `search_too_expensive`). The client now returns that error right away instead of running the same expensive search three more times.
