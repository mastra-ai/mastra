---
'@mastra/core': patch
---

Fixed two bugs that affected scheduled workflows.

**Scheduled workflow with mismatched `id` could not be dispatched ([#16471](https://github.com/mastra-ai/mastra/issues/16471))**

When a workflow's `id` differed from the key it was registered under, the scheduler published events the event processor could not resolve, causing the run to fail with "Workflow not found." The dispatcher now looks up workflows by `.id` first (falling back to the registration key), so the following now works as expected:

```ts
const workflow = createWorkflow({ id: 'daily-report', schedule: { cron: '0 9 * * *' } });
new Mastra({ workflows: { dailyReport: workflow } });
```

**Deleted scheduled workflows caused infinite event redelivery**

Removing a scheduled workflow from code used to leave its schedule row in storage. The scheduler kept firing for the missing workflow and the event processor kept telling the transport to redeliver the event forever. On boot, Mastra now cleans up declarative schedule rows (those it wrote itself, prefixed with `wf_`) for workflows that are no longer registered. User-created schedules made via the schedules API are left untouched. The event processor also handles in-flight events for missing workflows by emitting a single terminal `workflow.fail` instead of looping.
