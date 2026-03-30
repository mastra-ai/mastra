---
'@mastra/core': patch
---

Refactored MODEL_GENERATION span input to use serializeForSpan() for centralized, cleaner span serialization. Tagged system messages now include their tag metadata (e.g. 'memory') in trace output, making it easier to distinguish working memory and semantic recall instructions from base agent instructions in observability tools.
