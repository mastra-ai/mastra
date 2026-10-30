---
'@mastra/server': minor
---

Added Studio routes for an MCP server's tasks:

- `GET /mcp/:serverId/tasks` lists tasks newest first, 50 per page by default and at most 200. Filter by `status`, `surface` or `client`, and pass `nextCursor` for older tasks.
- `POST /mcp/:serverId/tasks/find` finds one task by its MCP task id, sent in the body.
- `POST /mcp/:serverId/tasks/:taskKey/cancel` cancels a task.
- `POST /mcp/:serverId/tasks/:taskKey/input` answers a task's input requests.

Listing and finding need `mcp:read`. Cancelling and answering need `mcp:write`. Server list and detail responses include `tasks_capability` when a server runs tools as tasks. Sessions scoped to a resource get no task list, since MCP clients and Mastra resources are separate identities.

```ts
const res = await fetch('/api/mcp/reports/tasks?status=input_required');
const { tasks, nextCursor } = await res.json();
if (tasks[0]) await fetch(`/api/mcp/reports/tasks/${tasks[0].taskKey}/cancel`, { method: 'POST' });
```
