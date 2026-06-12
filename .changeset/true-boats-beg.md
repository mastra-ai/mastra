---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/core': patch
'mastra': patch
---

Added a storage-backed endpoint for discovering suspended agent runs: `GET /agents/:agentId/suspended-runs`. It lists runs waiting on a tool-call approval or on a suspended tool, including the suspended tool calls, with optional `threadId`/`resourceId`/date filters and pagination. Server-enforced request-context values take precedence over client query parameters, so clients cannot list runs outside their scope. Because it reads from storage, it works after a server restart and across multiple server instances.
