---
'@mastra/memory': patch
---

Fixed the experimental vNext working memory tool letting one thread erase memory shared with other threads. With `scope` left at its default (`'resource'`), an update with `updateReason: 'replace-irrelevant-memory'` is now refused the same way as with an explicit `scope: 'resource'` setting, so a fact another conversation still needs isn't removed. The refusal now tells the agent the memory is shared and suggests `clarify-existing-memory` or `append-new-memory`, instead of saying no `searchString` was provided. Fixes [#30287](https://github.com/mastra-ai/mastra/issues/30287).
