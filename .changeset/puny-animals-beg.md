---
'@mastra/server': patch
---

Workspace tools like `ast_edit` are now correctly detected at runtime based on available dependencies (e.g. `@ast-grep/napi`), preventing missing tools from being advertised to agents.
