---
'@mastra/mcp': minor
---

**MCP tasks in Studio**

MCP servers with `tasks` enabled now report which tools run as tasks (`always` or `auto`, whether clients must support tasks to call them, and whether they recover after a restart), and give Studio an admin view to list tasks (filtered by status, tool or client, page by page), find one by its task id, and cancel or answer them. Cancelling or answering from Studio goes through the same path as the protocol's `tasks/cancel` and `tasks/update`. The view shows hashed task and client keys and a readable client label, never raw task ids or credentials. Custom task stores can opt in by implementing `MCPTaskStoreAdmin` (`list`, `updateByKey`, `cancelByKey`); stores without it are reported as not listable.

The MCP client now writes an `mcp-task` progress entry (`MCPTaskProgress`) to a tool's output stream when its call continues as an MCP task and whenever the task's status changes, so UIs can show the remote task id and status while it runs.
