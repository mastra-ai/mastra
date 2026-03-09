---
'@mastra/core': patch
---

Fixed dynamic model functions that return a single model so they no longer enter fallback-array mode. Request-context-based model selection now only exposes a model list when the function returns an array.
