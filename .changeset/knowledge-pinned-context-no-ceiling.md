---
'@mastra/core': patch
---

`pinnedContext.maxTokens` no longer has a 2,000-token ceiling. It budgets pinned pages only, so set it below your model's context limit to leave room for instructions, conversation history and model output, for example `pinnedContext: { maxTokens: 8000 }`. The default is still 500.
