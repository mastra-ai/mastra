---
'@mastra/memory': patch
---

Fixed observational memory erasing schema-based working memory. This happened when the Observer model returned an empty working-memory object, which Gemini does with `manageWorkingMemory: true`.

An empty working-memory result no longer replaces stored working memory. Mastra now retries the extraction when this happens. Other extracted values, such as the thread title, are kept whether the retry succeeds or fails.
