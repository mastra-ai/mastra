---
'@mastra/server': minor
---

Added HTTP routes to stop background tasks and to inspect or kill background processes in a workspace sandbox.

- `POST /api/background-tasks/:backgroundTaskId/cancel` cancels a pending, running or suspended task and returns it. A finished task is returned unchanged.
- `GET /api/workspaces/:workspaceId/sandbox/processes` lists the sandbox's background processes.
- `GET /api/workspaces/:workspaceId/sandbox/processes/:pid` returns a process's status and output without releasing an exited process, so the agent can still read it with `get_process_output`. Pass `tail` to get only the last N lines.
- `POST /api/workspaces/:workspaceId/sandbox/processes/:pid/kill` stops a process.

The process routes accept `threadId` and `resourceId` to list the processes one thread or resource started. A resource-scoped caller only sees its own resource's processes. The routes never create or start a sandbox: a sandbox that isn't running lists no processes, and a sandbox resolved per request is only found when an agent run already cached it under its `sandboxCacheKey`.
