---
'@mastra/client-js': patch
---

Added `visibility` and `authorId` fields to stored agent and skill response/request types. `listStoredAgents` and `listStoredSkills` now accept `visibility` and `authorId` query parameters for filtering by ownership and access level.
