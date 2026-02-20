---
'@mastra/server': patch
---

Updated workspace tool discovery to use `createWorkspaceTools` from core for accurate runtime detection of available tools (e.g. `ast_edit` requires `@ast-grep/napi`).
