---
'@mastra/agent-builder': patch
'@mastra/editor': patch
'@mastra/memory': patch
'@mastra/code-sdk': patch
---

Raised the `@mastra/core` peer floor to 1.86.0, the first release where agents send working memory instruction overrides from `Memory` subclasses to the model. `@mastra/agent-builder`, `@mastra/editor`, and `@mastra/code-sdk` depend on `@mastra/memory`, so their floor moves with it.
