---
'@mastra/client-js': patch
---

`listStoredAgents` and `listStoredSkills` now accept `visibility` and `authorId` parameters for filtering by access level and ownership. Response types for stored agents and skills include the new `visibility` and `authorId` fields.
