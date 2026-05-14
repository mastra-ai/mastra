### 5.1b.2 Durable Work and Background Task Records

```ts
type DurableWorkKind =
  | 'message'
  | 'queue'
  | 'wakeup'
  | 'channel-ingress'
  | 'channel-action'
  | 'channel-outbox'
  | 'inbox-response'
  | 'goal-continuation'
  | 'background-task';

type DurableWorkStatus =
  | 'admitted'
  | 'queued'
  | 'admitting'
  | 'running'
  | 'waiting'
  | 'resuming'
  | 'retrying'
  | 'claimed'
  | 'blocked'
  | 'completed'
  | 'delivered'
  | 'undelivered'
  | 'failed'
  | 'dead'
  | 'expired';

type DurableWorkProofKind =
  | 'accepted-signal'
  | 'queue-admission-receipt'
  | 'operation-admission-tombstone'
  | 'harness-wakeup-item'
  | 'channel-inbox-item'
  | 'channel-action-receipt'
  | 'channel-outbox-item'
  | 'inbox-response-receipt'
  | 'goal-decision-receipt'
  | 'background-task-row'
  | 'current-run-projection';

type BackgroundTaskRowStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out'
  | 'dead';

type BackgroundTaskOwnerRef =
  | { kind: 'queue-admission-receipt'; id: string }
  | { kind: 'channel-inbox-item'; id: string }
  | { kind: 'channel-action-receipt'; id: string }
  | { kind: 'channel-outbox-item'; id: string }
  | { kind: 'inbox-response-receipt'; id: string }
  | { kind: 'goal-decision-receipt'; id: string }
  | { kind: 'harness-wakeup-item'; id: string };

interface BackgroundTaskRowBase {
  id: string;
  harnessName: string;
  status: BackgroundTaskRowStatus;
  toolName: string;
  toolCallId: string;
  args: Record<string, JsonValue>;
  agentId: string;
  runId: string;
  threadId?: string;
  resourceId?: string;
  sessionId?: string;
  owningSessionId?: string;
  createdAt: number;
  updatedAt?: number;
  startedAt?: number;
  completedAt?: number;
  attempts: number;
  maxAttempts: number;
  timeoutMs: number;
  nextAttemptAt?: number;
  result?: JsonValue;
  error?: { code?: HarnessRowErrorCode; message: string; retryable?: boolean };
}

interface BackgroundTaskDiagnosticRow extends BackgroundTaskRowBase {
  durability: 'diagnostic';
  // Present when the task is merely execution machinery behind a
  // source-specific Harness row. Recovery, retry, and dead-letter behavior stay
  // with that owning row; the task row is not claimable through §5.2 helpers.
  ownerRef?: BackgroundTaskOwnerRef;
  claimId?: never;
  claimExpiresAt?: never;
  executorRef?: never;
  completionPolicyRef?: never;
}

interface BackgroundTaskReconstructableRow extends BackgroundTaskRowBase {
  durability: 'reconstructable';
  // Reconstructable task rows prove their tenant/session owner directly and may
  // be claimed as restart-safe worker state. They must not also sit behind an
  // owning source row, otherwise two recovery paths could race (§5.7, §15.1).
  resourceId: string;
  sessionId: string;
  threadId: string;
  ownerRef?: never;
  // Resolves through `HarnessConfig.backgroundTasks.executors[executorRef.id]`
  // (§9). v1 reconstructable background tasks use `kind: 'tool'`; other
  // executor kinds remain out of scope until a future registry entry defines
  // their reconstruction contract.
  executorRef: {
    id: string;
    kind: 'tool';
    generation?: string;
  };
  // Resolves through
  // `HarnessConfig.backgroundTasks.completionPolicies[completionPolicyRef.id]`
  // (§9). `metadata` is the per-row JSON-safe policy input and must validate
  // against the registered policy before executor start or completion retry.
  completionPolicyRef: {
    id: string;
    generation?: string;
    metadata?: JsonValue;
  };
  runtimeCompatibilityGeneration?: string;
  claimId?: string;
  claimOwnerId?: string;
  claimedAt?: number;
  claimExpiresAt?: number;
}

type BackgroundTaskStorageRow =
  | BackgroundTaskDiagnosticRow
  | BackgroundTaskReconstructableRow;
type ClaimableBackgroundTaskRow = BackgroundTaskReconstructableRow;

```

These v1 row shapes extend Mastra core's current `BackgroundTask` row
(`../packages/core/src/background-tasks/types.ts:11-41`) and the
`BackgroundTasksStorage` adapter
(`../packages/core/src/storage/domains/background-tasks/base.ts:20-54`) with
three families of v1-only fields:

1. **Storage-level claim/renew/CAS metadata** (`claimId`, `claimOwnerId`,
   `claimedAt`, `claimExpiresAt`) — the current adapter exposes CRUD/query/
   count methods, including `createTask` / `updateTask` / `getTask` /
   `listTasks` / `deleteTask` / `deleteTasks` / `getRunningCount` /
   `getRunningCountByAgent`; it has no `claim*` API. The current
   `BackgroundTaskManager` dispatches through in-memory `TaskContext` closures
   (`../packages/core/src/background-tasks/types.ts:303-308`,
   `../packages/core/src/background-tasks/manager.ts:32-33`) over a pubsub
   consumer group (`../packages/core/src/background-tasks/manager.ts:19-21,134-187`).
   Reconstructable rows need storage-level claim/renew with TTL because no
   in-memory closure survives a process restart.
2. **Reconstructable executor and completion-policy references** (`executorRef`,
   `completionPolicyRef`, `runtimeCompatibilityGeneration`) — durable
   handles that survive restart and let the worker rebuild the executor
   without referencing a live closure. The `runtimeCompatibilityGeneration`
   token's scope and fail-closed semantics are owned by §9.1.
3. **The `durability: 'diagnostic' | 'reconstructable'` distinction** —
   diagnostic rows correspond to the current closure-backed runtime model;
   they are observable but not claimable through storage primitives.

The `'dead'` terminal status in `BackgroundTaskRowStatus` is a v1 addition
not present in the current `BackgroundTaskStatus` literal set; §11.6a
records the literal-set gap on the `BackgroundTaskStatus` ledger entry.
