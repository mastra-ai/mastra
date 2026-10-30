---
'@mastra/core': minor
---

Added the experimental `getTasksInfo()` and `getTasksInspector()` methods to MCP servers, so tools like Studio can see which tools run as MCP tasks and list, cancel or answer a server's tasks.

```ts
const inspector = server.getTasksInspector();
const { tasks } = (await inspector?.list({ status: 'input_required' })) ?? { tasks: [] };
if (tasks[0]) await inspector?.cancel(tasks[0].taskKey);
```
