---
'@mastra/code-sdk': patch
---

`@mastra/code-sdk` now ships its own copy of the Knowledge scope id encoder instead of importing `encodeKnowledgeScopeId` from `@mastra/core`. If npm installs an older `@mastra/core`, `mastracode` still starts instead of crashing with "does not provide an export named 'encodeKnowledgeScopeId'". A test keeps the copy's output identical to core's.
