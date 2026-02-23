---
'@mastra/core': minor
---

Added `task_write` and `task_check` as built-in Harness tools. These tools are automatically injected into every agent call, allowing agents to track structured task lists without manual tool registration.

```ts
// Agents can call task_write to create/update a task list
await tools['task_write'].execute({
  tasks: [
    { content: 'Fix authentication bug', status: 'in_progress', activeForm: 'Fixing authentication bug' },
    { content: 'Add unit tests', status: 'pending', activeForm: 'Adding unit tests' },
  ],
});

// Agents can call task_check to verify all tasks are complete before finishing
await tools['task_check'].execute({});
// Returns: { completed: 1, inProgress: 0, pending: 1, allDone: false, incomplete: [...] }
```
