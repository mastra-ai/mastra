---
'@mastra/factory': minor
---

Added board-owned phase semantics. Every phase in `defineBoard()` now declares `kind: 'resting' | 'working' | 'terminal'`, and working phases name the agent `role` that carries them. The runtime reads those declarations from the installed board for consent arming, the external-author guard, kickoff seating, run-start lanes, terminal cleanup, closed-PR and issue sweeps, and supervisor findings instead of matching built-in phase names. Custom boards now get their own terminal cleanup, consent handling, and role routing and no longer inherit Work's meanings by accident; unknown boards or phases fail closed (consent requested, nothing cleaned up, no seat started or revoked). Work and Review behave as before.

Existing `defineBoard()` calls must add `kind` to every phase and `role` to working phases; `initialPhase` must be resting.

```ts
// before
phases: { queued: { title: 'Queued', next: 'shipped' }, shipped: { title: 'Shipped' } }
// after
phases: {
  queued: { title: 'Queued', kind: 'resting', next: 'shipped' },
  shipped: { title: 'Shipped', kind: 'terminal' },
}
```

Decision and tool-input validation still accept only built-in board IDs and phase names, and `factory-ui` still renders the built-in pipeline.
