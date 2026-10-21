---
'@mastra/core': minor
---

Agent schedules can now send an idle wake to the worker that has claimed the thread. Set `ifIdle.requireClaimedOwner: true` on the schedule, or return it from the `prepare` hook. This works the same way as `agent.sendSignal`: the claim holder runs the turn with its own claim stream options. If no owner answers, the fire fails with `outcome: 'failed'`. Before this change, the option was dropped, so whichever worker took the fire ran the turn itself.

```ts
await mastra.schedules.create({
  agentId: 'support',
  cron: '0 * * * *',
  prompt: 'Check in',
  threadId,
  resourceId,
  ifIdle: { behavior: 'wake', requireClaimedOwner: true },
});
```
