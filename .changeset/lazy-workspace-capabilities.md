---
'@mastra/server': patch
---

Fixed `GET /api/workspaces` and `GET /api/workspaces/:workspaceId` reporting `hasFilesystem: false` and `hasSandbox: false` for workspaces whose filesystem or sandbox is a resolver function. Capabilities now reflect the configuration without calling the resolvers.
