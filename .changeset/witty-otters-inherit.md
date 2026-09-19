---
'@mastra/editor': patch
---

Builder agents now inherit the shared stability error processors from `@mastra/core` instead of carrying their own copy. `DEFAULT_BUILDER_ERROR_PROCESSORS` is still exported and now resolves to the shared defaults.
