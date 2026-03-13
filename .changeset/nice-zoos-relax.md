---
'@mastra/core': patch
---

Fixed workspace tools such as `mastra_workspace_list_files` and `mastra_workspace_read_file` failing with `WorkspaceNotAvailableError` in some execution paths.

Workspace tools now work consistently across execution paths.
