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

**Workflows**: a workflow task follows one run, started once when the task is created. A suspended step asks the client for input through the task, and the answer resumes the run. Cancelling the task cancels the run, even while it waits for input. A run that fails completes the task with `isError: true`. When a server stops mid-run, Mastra's workflow recovery continues the run on the next instance and the task follows it.

**Agents**: an agent task runs the agent's answer as the task, cancels it through its abort signal, and supports `recover`. An agent that pauses for tool approval completes the task with an error, since tasks can't answer approvals yet.

`tasks.default` now also applies to workflows and agents not listed in `tasks.workflows` or `tasks.agents`, and `tasks.required` takes the names clients call, such as `run_nightly`.
