---
'@mastra/playground-ui': minor
---

Replaced the task list's progress bar and "2/4 completed" label with a compact status strip in the header. One bar per task, colored by state (green completed, orange in progress, grey pending), with the exact count on hover. Frees the vertical space the progress bar used to take.

`<TaskList>` is unchanged. The strip now derives everything from the tasks, so `TaskListCount` and `TaskListCountProps` are removed, and `TaskListProgress` takes the tasks instead of a completed/total pair. Both were reachable from `@mastra/playground-ui/components/ai/task-list`.

There is no replacement for `TaskListCount` — the count lives in the strip's tooltip. Callers of `TaskListProgress` pass the tasks they already render:

```tsx
const tasks = [
  { id: '1', content: 'Inspect code', activeForm: 'Inspecting code', status: 'completed' },
  { id: '2', content: 'Add tests', activeForm: 'Adding tests', status: 'in_progress' },
  { id: '3', content: 'Build package', activeForm: 'Building package', status: 'pending' },
];

// Before
<TaskListCount completed={1} total={3} />
<TaskListProgress completed={1} total={3} />

// After
<TaskListProgress tasks={tasks} />
```
