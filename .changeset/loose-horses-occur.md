---
'@mastra/memory': patch
---

Fixed Markdown working memory updates being silently dropped with Observational Memory's manageWorkingMemory. The Observer's <working-memory> section is now required: the model answers UNCHANGED when nothing changed, and a missing section is recorded as an extraction failure instead of being skipped silently. Fixes #25350
