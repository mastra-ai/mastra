---
'@mastra/server': patch
---

Fixed the skill reference endpoint (`GET /workspaces/:workspaceId/skills/:skillName/references/:referencePath`) returning 404 for valid reference files.
