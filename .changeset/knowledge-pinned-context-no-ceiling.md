---
'@mastra/core': patch
---

`pinnedContext.maxTokens` no longer has a 2,000-token ceiling. Set it to whatever your model's context can hold, for example `pinnedContext: { maxTokens: 8000 }`. The default is still 500.
