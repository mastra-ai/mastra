---
'@mastra/server': patch
---

Added mount-aware skill installation for CompositeFilesystem workspaces. The install, remove, and update handlers now resolve the correct mount when multiple filesystem mounts are configured. Workspace info endpoint now includes mount metadata when available.
