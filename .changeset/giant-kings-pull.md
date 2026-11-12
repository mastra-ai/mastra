---
'@mastra/server': minor
---

Added HTTP routes to stop background tasks and to inspect or kill background processes in a workspace sandbox.

- `POST /api/background-tasks/:backgroundTaskId/cancel` cancels a pending, running or suspended task and returns it. A finished task is returned unchanged.
- `GET /api/workspaces/:workspaceId/sandbox/processes` lists the sandbox's background processes.
- `GET /api/workspaces/:workspaceId/sandbox/processes/:pid` returns a process's status and output without taking it from the agent.
- `POST /api/workspaces/:workspaceId/sandbox/processes/:pid/kill` stops a process.

The process routes accept `threadId` and `resourceId` to list the processes one thread or resource started. A resource-scoped caller only sees its own resource's processes. For a sandbox resolved per request, the routes resolve it with the requested thread and resource, so a `sandboxCacheKey` keyed on either finds the sandbox the agent used.
