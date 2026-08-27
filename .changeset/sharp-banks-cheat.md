---
'@mastra/playground-ui': patch
---

Studio pages that fail to load now decide what to show from the error itself. A 401 offers a way back in, a 403 names the resource you were refused, and anything else shows the message the server sent — through one `<QueryError />` instead of a hand-written chain on each page.
