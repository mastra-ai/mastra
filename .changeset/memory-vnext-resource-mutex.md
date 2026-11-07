---
'@mastra/memory': patch
---

Fixed concurrent working memory updates from different threads overwriting each other when working memory uses the default resource scope. The update lock now uses the resolved scope instead of only the scope passed on the call.
