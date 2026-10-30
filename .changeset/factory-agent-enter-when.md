---
'@mastra/factory': minor
---

Added `agentEnterWhen` to board phases, so a board can say which cards agents may move into a phase. People and board rules are never held back. Work and Review now use it instead of transition policies. Agents can close Work cards when there is no open pull request, no review asked for changes, and self-review approved. They still can't skip Planning or close a card a person has to look at.

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

**Deprecated.** `transitionPolicy` on `defineBoard()` still runs, and logs one warning per board. Move each rule to `agentEnterWhen` on the destination phase:

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
