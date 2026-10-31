---
'@mastra/factory': minor
---

Work and Review boards no longer use transition policies. Each phase's `nextPhases` now says where a card can go, for people, agents and board rules alike, and Work's Planning ends with `submit_plan` as its exit tool.

**Work board moves.** Cards follow the Work flow instead of moving anywhere:

| From | To |
| --- | --- |
| Intake | Triage, Planning, Review, Done, Canceled |
| Triage | Intake, Planning, Done, Canceled |
| Planning | Building, Intake, Done, Canceled |
| Building | Review, Planning, Done, Canceled |
| Review | Building, Intake, Done, Canceled |
| Done | Review |
| Canceled | Intake, Review |

This applies to people too: you can no longer drag a card from Intake or Triage straight into Building, and a card self-review parks in Intake resumes through Review. Pull request cards still only sit in Intake, Review, Done or Canceled. When work counts as finished (no open pull request, no review asking for changes) is now in the build and self-review instructions rather than enforced by the board.

**Plans always wait for a person.** The project's **Auto-approve plans** setting is removed. Every plan on the Work board waits for a person, who moves the card on or approves `submit_plan` in a chat they are signed in to. Projects that had the setting on now see plans wait. Custom boards can still approve plans without a person with `exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen }`. The project update API still accepts `autoApprovePlans` for one release and ignores it. `factory_update_work_item` and `PATCH /work-items/:id` no longer take `plansPreapproved`, and cards no longer report `plansPreapprovedAt`: the per-card pre-approval never skipped a plan on this board.

**Triage.** Factory no longer records a triage classification or acceptance. The triage agent sends open non-bugs back to Intake, and a person moving the card on is the approval. On boot, Factory moves cards still waiting in Triage under the old rule back to Intake once. The `triageType` argument of `factory_transition_work_item` is ignored.

**Deprecated.** `transitionPolicy` on `defineBoard()` still runs, and logs one warning per board. `triageType` and `accept` on an `allow` result are now ignored; before, an intent the actor wasn't allowed to make failed the transition with a `rule_error`. Express the flow with `nextPhases` and `exitTool` instead:

```typescript
// before
transitionPolicy: context => {
  if (context.fromStage === 'backlog' && context.toStage === 'done') {
    return { type: 'reject', code: 'invalid_transition', reason: 'Build it first.' };
  }
},
// after, on the backlog phase
nextPhases: ['build'],
```
