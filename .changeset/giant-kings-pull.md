---
'@mastra/server': minor
---

Added HTTP routes to inspect or kill background processes in a workspace sandbox.

- `GET /api/workspaces/:workspaceId/sandbox/processes` lists the sandbox's background processes.
- `GET /api/workspaces/:workspaceId/sandbox/processes/:pid` returns a process's status and output without releasing an exited process, so the agent can still read it with `get_process_output`. Pass `tail` to get only the last N lines.
- `POST /api/workspaces/:workspaceId/sandbox/processes/:pid/kill` stops a process.

```bash
curl "http://localhost:4111/api/workspaces/my-workspace/sandbox/processes?threadId=thread-1"
curl "http://localhost:4111/api/workspaces/my-workspace/sandbox/processes/$PID?threadId=thread-1&tail=50"
curl -X POST "http://localhost:4111/api/workspaces/my-workspace/sandbox/processes/$PID/kill?threadId=thread-1"
```

The process routes accept `threadId` and `resourceId` to list the processes one thread or resource started. A resource-scoped caller only sees its own resource's processes. The routes never create or start a sandbox: a sandbox that isn't running lists no processes, and a sandbox resolved per request is only found when an agent run already cached it under its `sandboxCacheKey`. Thread and resource filters and per-request sandboxes need the matching `@mastra/core` release. With an older core, a workspace with a per-request sandbox returns `404`, and processes carry no owner, so thread and resource filters match nothing.
