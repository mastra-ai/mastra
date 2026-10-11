---
'@mastra/memory': patch
---

Fixed observational memory wiping schema-based working memory when the Observer model (for example Gemini with `manageWorkingMemory: true`) returned an empty working-memory object. An empty working-memory extraction now triggers the JSON-prompt retry and never overwrites stored working memory; if the retry fails, other extracted values (such as the thread title) are still kept.
