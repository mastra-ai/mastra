---
'@mastra/pg': minor
---

Added PostgreSQL persistence for workflow snapshot handoffs. Claim, transition, and completion records now survive process restarts, and a pending or completed handoff permanently fences late native writes so a recovered run cannot resurrect superseded state.

```ts
import { PostgresStore } from '@mastra/pg';

const store = new PostgresStore({ id: 'store', connectionString });
const workflows = await store.getStore('workflows');

// Claim the handoff: compare-and-set on the run's canonical snapshot state.
const claim = await workflows.claimWorkflowSnapshotHandoff({
  workflowName: 'research-flow',
  runId: 'run-123',
  expectedCanonical: { kind: 'absent' },
  snapshot, // replacement WorkflowRunState
  mutationFence: 'broker-owner-token',
});
// claim.status: 'created' | 'existing' | 'completed' | 'conflict' | 'unsupported'

// After migration finishes, mark the handoff complete. Ordinary writes such as
// persistWorkflowSnapshot then throw WorkflowSnapshotHandoffFenceError forever.
await workflows.completeWorkflowSnapshotHandoff({
  workflowName: 'research-flow',
  runId: 'run-123',
  expectedSnapshot: claim.status === 'created' ? claim.record.snapshot : snapshot,
  snapshot: finalSnapshot, // terminal WorkflowRunState
  mutationFence: 'broker-owner-token',
});
```
