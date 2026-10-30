---
'@mastra/mcp': minor
---

Added MCP tasks for workflows and agents served by `MCPServer` (experimental). The `tasks.workflows` and `tasks.agents` options let `run_<workflow>` and `ask_<agent>` answer with a task, using the same modes as tools.

```typescript
const server = new MCPServer({
  id: 'reports',
  name: 'Reports',
  version: '1.0.0',
  workflows: { nightly },
  agents: { researcher },
  tasks: {
    workflows: { nightly: 'always' },
    agents: { researcher: { mode: 'auto', syncWindowMs: 1000 } },
  },
});
```

**Workflows**: a workflow run starts once per request, and the task follows that run. A suspended step with a `resumeSchema` the client can fill in asks for input through the task, and the answer resumes the run. Other suspended steps leave the task `working` until the run is resumed some other way. Cancelling the task cancels the run, even while it waits for input. A run that fails completes the task with `isError: true`. With tasks kept in Mastra storage under a stable `MCPServer` `id`, when a server stops mid-run, Mastra's workflow recovery continues the run on the next instance and the task follows it. Tasks kept in memory end with the server.

**Agents**: an agent task runs the agent's `generate()` call as the task's work. Cancelling the task aborts that call, and agent tasks support `recover`. An agent that pauses for tool approval completes the task with an error, since tasks can't answer approvals yet.

`tasks.default` now also applies to workflows and agents not listed in `tasks.workflows` or `tasks.agents`, and `tasks.required` takes the names clients call, such as `run_nightly`.
