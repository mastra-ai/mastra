---
'@mastra/editor': patch
---

Builder agents now inherit the shared stability error processors from `@mastra/core` instead of carrying their own copy. `DEFAULT_BUILDER_ERROR_PROCESSORS` is still exported and now resolves to the shared defaults. The `@mastra/core` peer range rises to `>=1.68.0-0`, the release that adds that export; an earlier core in the old range would throw at import.
