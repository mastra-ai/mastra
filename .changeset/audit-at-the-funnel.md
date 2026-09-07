---
'@mastra/factory': patch
---

The audit trail now records every stage move, run start and run end, whoever caused it. Before, only moves and starts made from the browser left a row: a rule, an agent tool, a GitHub event or the supervisor moving a card was invisible, and no run ever recorded that it ended.

What lands in the trail now:

- `factory.work_item.stage_moved` and `factory.work_item.transition_rejected` for every accepted or rejected transition, under the real actor: the person, `agent:<binding>`, `github:<login>`, or actor type `system` for a rule
- `factory.run.started` for every kickoff that is not a replay, including the ones the rule dispatcher starts on its own
- `factory.run.ended`, a new action, with the run's `reason`

Filing a session onto a role is audited as `factory.work_item.updated` with `fields: ['sessions']`, no longer as a run start.

```ts
const { events } = await audit.list({ orgId, factoryProjectId, actions: ['factory.run.ended'] });
// events[0].metadata → { reason: 'complete', sessionId, threadId }
```
