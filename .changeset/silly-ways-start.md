---
'@mastra/factory': patch
---

Fixed a critical bug where `createWorkspaceFactory` never registered the workspace it built with the Mastra instance. Any HTTP handler that resolved a factory workspace synchronously via `mastra.getWorkspaceById(id)` (file tree, permissions probe, MCP/tool routes) threw `MASTRA_GET_WORKSPACE_BY_ID_NOT_FOUND`, surfacing as sustained `Workspace with id ... not found` / `Error calling handler` log noise on live Factory sessions. The factory now registers the workspace with the Mastra registry before returning it, so sync lookups succeed on the first request and reuse the same instance on later ones.
