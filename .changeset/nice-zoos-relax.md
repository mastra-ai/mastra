---
'@mastra/core': patch
---

Fixed workspace tools (e.g. `mastra_workspace_list_files`, `mastra_workspace_read_file`) throwing `WorkspaceNotAvailableError` when the workspace context was not provided at runtime. Workspace is now baked into tool options at build time, so workspace tools work reliably in all execution paths.
