---
'@mastra/core': patch
'@mastra/server': patch
---

Studio's Knowledge graph and explorer now show grants and scope labels from store-supplied declarations (e.g. Platform Knowledge) on the first request, not only after another call loaded them. Adds `Knowledge.resolveScopeDeclarations()`.
