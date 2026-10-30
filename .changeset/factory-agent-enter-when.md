---
'@mastra/factory': minor
---

Added `agentEnterWhen` to board phases, so a board can say which cards agents may move into a phase. People and board rules are never held back. Work and Review now use it instead of transition policies. Agents can close Work cards when there is no open pull request and no review asked for changes; a card leaving Review also needs an approving self-review or a recorded verdict. Agents still can't close a card a person has to look at.

What changes for agents on the Work board:

- They can't move a card from Intake or Triage into Building, even when plans are auto-approved (before, auto-approve let them skip Planning).
- From Planning, they can't move a card into another working phase (Triage, Building, Review) unless the plan was approved or plans are auto-approved. Before, only Building needed that.

```typescript
phases: {
  build: {
    name: 'Build',
    kind: 'working',
    runner: { context: 'release' },
    // Agents start the build only for cards a maintainer labelled.
    agentEnterWhen: {
      operator: 'AND',
      conditions: [{ field: 'item.labels', operator: 'contains', value: 'release:approved' }],
    },
  },
  published: { name: 'Published', kind: 'terminal', agentEnterWhen: false },
}
```

Rules can test new card facts: `item.phase`, `item.openPullRequest`, `item.reviewVerdict`, `item.selfReviewVerdict` and `item.selfReviewNeedsHuman`. Stored boards and the board catalog carry `agentEnterWhen` too.

**Triage.** Factory no longer records a triage classification or acceptance. The triage agent sends open non-bugs back to Intake, and a person moving the card on is the approval. On boot, Factory moves cards still waiting in Triage under the old rule back to Intake once. The `triageType` argument of `factory_transition_work_item` is ignored.

**Deprecated.** `transitionPolicy` on `defineBoard()` still runs, and logs one warning per board. `triageType` and `accept` on an `allow` result are now ignored; before, an intent the actor wasn't allowed to make failed the transition with a `rule_error`. Move each rule to `agentEnterWhen` on the destination phase:

```typescript
// before
transitionPolicy: context => {
  if (context.toStage === 'build' && !context.isHumanTransition) {
    return { type: 'reject', code: 'approval_required', reason: 'A person must approve this release.' };
  }
},
// after, on the build phase
agentEnterWhen: false,
```
