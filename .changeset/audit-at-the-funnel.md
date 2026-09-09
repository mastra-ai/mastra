---
'@mastra/factory': patch
---

The audit trail now records every stage move, run start and run end, whoever caused it. Before, only moves and starts made from the browser left a row: a rule, an agent tool, a GitHub event or the supervisor moving a card was invisible, and no run ever recorded that it ended.

What lands in the trail now:

- `factory.work_item.stage_moved` and `factory.work_item.transition_rejected` for every accepted or rejected transition (deduplicated by transition identity), under the real actor: the person, `agent:<binding>` (also when the dispatcher carries an agent's approval), `github:<login>`, or actor type `system` for a rule. A re-entry onto the stage a card already holds is recorded with `reenter: true`.
- `factory.run.started` for every kickoff that reaches an agent, including the ones the rule dispatcher starts on its own. Opening a card only prepares its session; confirmed dispatcher delivery records the kickoff, including when it reuses a live session. Concurrent retries share one local event and one mirror export.
- `factory.run.ended`, a new action, once per kickoff: the first turn that ends without suspending closes the run with its `reason`, `kickoffId`, `bindingId`, `role`, `startedBy` and `agentName`. Shared-thread role handoffs retain each kickoff, and `startedBy` identifies the approver rather than the session credential owner
- `factory.agent.pr_opened`, a new action, when an agent's `gh pr create` prints the pull request it opened; the row targets that pull request by URL, and a preview, a browser hand-off or a failed create records nothing
- supervisor tool writes now go through the audit domain, so they reach the WorkOS mirror like every other row
- transition rows a person causes from the board carry that request's `location` and `userAgent`, so the WorkOS mirror stops exporting them as `unknown`

Filing a session onto a role is audited as `factory.work_item.updated` with `fields: ['sessions']`, no longer as a run start.

The list route filters by namespace instead of by action list: `GET /audit?namespaces=run,agent`. A `namespaces=` naming no known namespace is a 400, never an unfiltered page. The actions each namespace holds live in one registry on the server, `AUDIT_ACTIONS` in `storage/domains/audit/actions`, and `record`/`emit` only accept actions from it. The same module reads an action back (`parseAuditAction`, `isAuditAction`), so a client derives its categories and labels from the registry instead of copying it.

Two more modules under `storage/domains/audit` carry what a client needs without pulling storage code: `actors` (`AUDIT_ACTOR_TYPES`, `isAuditActorType`, `isHumanActorId`, the one place that knows which actor ids are the factory itself) and `wire` (`WireAuditEvent`, `WireAuditPage`, `toWireAuditEvent`). The list route now returns `WireAuditPage`: `orgId`, `factoryProjectId`, `projectRepositoryId` and the request `context` no longer leave the server.

```ts
const { events } = await audit.list({ orgId, factoryProjectId, actions: ['factory.run.ended'] });
// events[0].metadata → { reason: 'complete', bindingId, role, startedBy, agentName, sessionId, threadId }
```
