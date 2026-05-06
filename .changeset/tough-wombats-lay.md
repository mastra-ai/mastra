---
'@mastra/core': major
---

Added stable IDs to Harness task items and new built-in tools for updating or completing one task by ID.

Tasks can now be updated or completed without replacing the full task list. This helps agents keep long-running plans stable while changing one item at a time. Task tool results now include a structured task list snapshot so agent UIs can replay task state reliably from history. `task_check` also returns `summary` and `incompleteTasks` fields so agents and UIs can check completion without parsing text.

**Breaking type change:** `TaskItem` now represents normalized task state and tool results with a required stable `id`. Use `TaskItemInput` for `task_write` input where the `id` may be omitted. The harness also exports `assignTaskIds` for UIs that need to replay legacy task history with the same ID assignment rules as the built-in tools.

When `task_write` input omits IDs, Harness only reuses historical IDs for unambiguous content matches. If duplicate task content makes a historical match unsafe, Harness returns deterministic generated IDs instead. Explicit IDs are preserved and take precedence over compatibility reuse.

Before this change, updating one task required rewriting the full task list with `task_write`.

```typescript
await tools['task_write'].execute({
  tasks: [
    {
      content: 'Write tests',
      status: 'in_progress',
      activeForm: 'Writing tests',
    },
    {
      content: 'Run checks',
      status: 'pending',
      activeForm: 'Running checks',
    },
  ],
});
```

Now agents can update or complete the target task by stable ID.

```typescript
await tools['task_update'].execute({
  id: 'task_write_tests',
  status: 'in_progress',
});

await tools['task_complete'].execute({
  id: 'task_write_tests',
});
```
