---
'@mastra/memory': minor
'@mastra/core': minor
'mastra': minor
---

Memory breaking changes: storage, vector, and embedder are now required. Working memory text streaming has been removed, only tool calling is supported for working memory updates now. Default settings have changed (lastMessages: 40->10, semanticRecall: true->false, threads.generateTitle: true->false)
