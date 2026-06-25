---
"@internal/playground": patch
---

Added visual task list rendering in Mastra Studio for agent task tools (task_write, task_update, task_complete, task_check) and task state signals. Shows a compact checklist with progress bar, status icons, and completion summary instead of raw JSON.

When an agent emits a task tool result or a task state signal carrying this shape, Studio renders it as a checklist:

```ts
// Task result / signal payload consumed by the renderer
{
  tasks: [
    { id: '1', content: 'Scaffold the project', status: 'completed', activeForm: 'Scaffolding the project' },
    { id: '2', content: 'Wire up the API', status: 'in_progress', activeForm: 'Wiring up the API' },
    { id: '3', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' },
  ],
}
// status is one of: 'pending' | 'in_progress' | 'completed'
```
