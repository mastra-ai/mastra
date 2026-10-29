---
'@mastra/core': patch
---

`isInlineSkill()` now recognises only skills returned by `createSkill()`. A hand-built object with `__inline: true` skipped `createSkill()`'s validation and is no longer treated as an inline skill. Skills created by `createSkill()`, including spread copies of them, work as before.
