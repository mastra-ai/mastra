---
'@mastra/factory': patch
---

The audit trail now records every stage move, run start and run end, whoever caused it. Before, only moves and starts made from the browser left a row: a rule, an agent tool, a GitHub event or the supervisor moving a card was invisible, and no run ever recorded that it ended.

What lands in the trail now:

- `factory.work_item.stage_moved` and `factory.work_item.transition_rejected` for every accepted or rejected transition, under the real actor: the person, `agent:<binding>` (also when the dispatcher carries an agent's approval), `github:<login>`, or actor type `system` for a rule. A re-entry onto the stage a card already holds is recorded with `reenter: true`.
- `factory.run.started` for every kickoff that is not a replay, including the ones the rule dispatcher starts on its own
- `factory.run.ended`, a new action, once per kickoff: the first turn that ends without suspending closes the run with its `reason`, `bindingId`, `role`, `startedBy` and `agentName`
- `factory.agent.pr_opened`, a new action, when an agent runs `gh pr create`
- supervisor tool writes now go through the audit domain, so they reach the WorkOS mirror like every other row

Filing a session onto a role is audited as `factory.work_item.updated` with `fields: ['sessions']`, no longer as a run start.

The list route filters by namespace instead of by action list: `GET /audit?namespaces=run,agent`. The actions each namespace holds live in one registry on the server, `AUDIT_ACTIONS`, and `record`/`emit` only accept actions from it.

```ts
const { events } = await audit.list({ orgId, factoryProjectId, actions: ['factory.run.ended'] });
// events[0].metadata → { reason: 'complete', bindingId, role, startedBy, agentName, sessionId, threadId }
```
