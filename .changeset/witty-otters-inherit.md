---
'@mastra/editor': patch
---

Builder agents now inherit the shared stability error processors from `@mastra/core` instead of carrying their own copy, so `createBuilderAgent` resolves the same three processors in the same order as every other agent. `DEFAULT_BUILDER_ERROR_PROCESSORS` is still exported and keeps its existing `@mastra/core` peer range.
