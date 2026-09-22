---
'@mastra/server': patch
---

Fixed workspace and skills query flags parsing the string `"false"` as `true`. The `recursive` flag on list/write/mkdir/delete, the `force` flag on delete, and the `includeReferences` flag on skills search now parse `"false"` as `false`, so a client that explicitly disables a flag no longer has it silently turned on.

Fixes #24511.