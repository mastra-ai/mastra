---
'@mastra/connect': patch
---

Dynamic importer examples and the missing-access-map error now use `project:$projectId` (for example `{ 'project:$projectId': 'owner' }`) instead of `resource:$projectId`, matching how Factory routes each connection's imports to a project.
