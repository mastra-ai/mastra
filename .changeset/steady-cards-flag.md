---
'@mastra/factory': minor
---

A card on a workflow board now ends somewhere a person can act on when its automation fails or is stopped. With `createWorkflowBoardEngine`, the card's run counts each failed attempt at its phase's run as `attempts`, and when the dispatcher gives up (attempts spent, a failure it can't retry, or a board rule refusing the run's move) the card is `needs_attention` with the failure's label as its `reason`:

```ts
const doing = await boardEngine.describe?.({ workItemId });
// { state: 'needs_attention', phase: 'execute', probes: 0, attempts: 5, failure: 'run_failed', reason: 'Agent run ended in error' }
```

Stop on a running card leaves it in its phase, `needs_attention` with reason `Stopped by a person.`, until someone starts it again. Cancel (a person's move into a terminal phase) now stops the phase's run before it lands. Custom engines can hear of these through the new optional `runFailed(seat, failure)` and `runStopped(seat)` members. The default engine behaves as before.
