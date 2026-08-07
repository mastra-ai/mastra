---
'@mastra/memory': patch
---

Retry working memory extraction with JSON prompt injection when native structured output returns an empty object, so schema updates are no longer silently skipped when the model omits the `working-memory` extractor wrapper. Fixes #20503.
