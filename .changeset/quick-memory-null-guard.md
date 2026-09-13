---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed the working memory system instruction so a thread or resource with no stored working memory shows an explicit "No working memory data available." marker instead of the literal string `null`. Fixes #23724.
