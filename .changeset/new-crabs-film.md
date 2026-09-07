---
'@mastra/rag': patch
---

Fixed `separatorPosition: 'start'` chunking silently dropping trailing and consecutive separators. The `character` and `recursive` strategies now keep every separator, so the joined chunks reproduce the original text. Fixes https://github.com/mastra-ai/mastra/issues/23122
