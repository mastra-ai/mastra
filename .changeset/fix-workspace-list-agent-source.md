---
'@mastra/server': patch
---

Fixed `GET /api/workspaces` returning `source: 'mastra'` for all workspaces. Agent workspaces now correctly return `source: 'agent'` with `agentId` and `agentName` populated.
