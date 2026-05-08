### 5.1 What gets persisted

```ts
interface SessionRecord {
  id: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;          // subagent linkage

  // Per-turn defaults
  modeId: string;
  modelId: string;
  subagentModelOverrides: Record<string, string>;

  // Permissions
  permissionRules: PermissionRules;
  sessionGrants: SessionGrants;

  // Counters
  tokenUsage: TokenUsage;

  // In-flight state (resumable across restarts).
  // `pendingQueue.length` is bounded by `sessions.maxQueueDepth` (§9). The
  // capacity check and the durable append are linearised under the session's
  // write lease (§5.8); admission past the cap rejects with
  // `HarnessQueueFullError` before touching storage.
  pendingQueue: QueuedItem[];
  pendingApproval?: PendingApproval;
  pendingSuspension?: PendingToolSuspension;
  pendingQuestion?: PendingQuestion;
  pendingPlan?: PendingPlanApproval;

  // Observational memory config
  observationalMemory?: {
    observerModelId?: string;
    reflectorModelId?: string;
  };

  // Active goal — set via `session.setGoal(...)`, evaluated after each
  // assistant turn. See §4.7.
  goal?: GoalState;

  // Per-session workspace state (only populated under `kind: 'per-session'`
  // with a `resumable: true` provider). `providerId` is the registered
  // provider's stable identity (e.g. 'e2b', 'daytona', 'modal'); `state` is
  // the opaque blob the provider reports via the workspace's state-update
  // hook and is fed back to `provider.resume({ state, ... })` after a
  // server restart. Providers must declare `resumable` statically; the
  // harness rejects `kind: 'per-session'` against `resumable: false` providers
  // at `init()`, before any sandbox is provisioned. See §2.7 and §9.
  workspace?: {
    providerId: string;
    state: unknown;
  };

  // User-defined custom state (typed via TState generic on Harness)
  state: unknown;

  // Lifecycle
  createdAt: number;
  lastActivityAt: number;
  closedAt?: number;

  // Write-concurrency — see §5.8.
  version: number;            // Monotonically incremented on every successful saveSession.
                              //   Used for optimistic-CAS conflict detection.
  ownerId?: string;           // ownerId of the Harness instance currently holding the lease,
                              //   or undefined if the record is unowned (no live Session).
  leaseExpiresAt?: number;    // Epoch ms — when the current lease TTLs out. Adapters that
                              //   provide a native lease primitive may store this implicitly.
}

interface SessionSummary {
  id: string;
  resourceId: string;
  threadId: string;
  parentSessionId?: string;
  lastActivityAt: number;
  closedAt?: number;
}

// `pendingQueue` holds items added via `session.queue(...)` only.
// Items added via `session.message(...)` are NOT persisted here — they go
// straight to `agent.sendSignal(...)` and durability post-acceptance is owned
// by the agent layer (signals are durable by design, with stable IDs and
// replay prevention). Pre-acceptance crashes lose the message; the user
// resends. Slack semantics.
//
// Inline-form FileAttachments are flushed to HarnessStorage.saveAttachment(...)
// before the item is persisted, so the queue contains only references — never
// raw bytes.
interface QueuedItem {
  id: string;                       // unique per session, used for ack/cancel
  enqueuedAt: number;
  content: string;
  attachments: PersistedAttachment[];
  // Per-turn overrides, captured at enqueue time
  model?: string;
  mode?: string;
  yolo?: boolean;
  // `addTools` is intentionally absent — tool implementations are closures
  // and cannot be serialised. The corresponding option is rejected at
  // `queue(...)` admission with `HarnessValidationError` (both at the type
  // level via `Omit<HarnessOverrides, 'addTools'>` and at runtime), so a
  // queued item never carries a request for a tool surface it cannot
  // honour after a crash. Callers who need a one-shot custom tool surface
  // should use `message(...)` on an idle thread or `useSkill(...)`. See
  // §4.3.
}

type PersistedAttachment =
  | { kind: 'ref'; name: string; mimeType: string; attachmentId: string }
  | { kind: 'url'; name: string; mimeType: string; url: string };

// Permissions — plain JSON, no functions, no closures.
interface PermissionRules {
  categories: Record<string, 'allow' | 'deny' | 'ask'>;  // per-category default
  tools: Record<string, 'allow' | 'deny' | 'ask'>;       // per-tool override (wins)
}

interface SessionGrants {
  categories: string[];   // granted for the lifetime of this session only
  tools: string[];
}

// All four "pending" shapes correlate a Mastra agent suspension with
// session-scoped UX. The actual paused execution state lives in the workflow
// snapshot under `MastraStorage.workflows`, keyed by `runId`. The harness only
// stores enough to rebuild the UX and resume:
//
//   await agent.resumeStream(resumeData, { runId });
//
// The shapes are deliberately distinct because the resume payloads are
// distinct: an approval gate carries `{ approved, reason? }`; a tool
// suspension carries opaque `resumeData` that flows back into the paused
// tool's continuation; a question carries the user's answer; a plan
// approval carries `{ approved, reason? }` and may flip the session's mode.
// `source` distinguishes whether the suspension came from the parent session's
// own turn or from a subagent — drives state-isolation rules in §8.

interface PendingApproval {
  kind: 'tool-approval';            // gate: model wants to call a tool, user decides yes/no
  runId: string;
  toolCallId: string;
  toolName: string;
  toolCategory?: string;            // enables "approve category" UX
  input: unknown;                   // serialised tool input
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}

interface PendingToolSuspension {
  kind: 'tool-suspension';          // mid-execution: tool ran, called suspend(data), waiting for external resume
  runId: string;
  toolCallId: string;
  toolName: string;
  // The tool's serialised `suspend(...)` payload — what the tool author
  // chose to expose to the resumer (e.g. `{ webhookUrl, expectedSignature }`).
  // Opaque to the harness; rendered by the UI / handed to the external
  // system that produces the resume payload.
  suspendData: unknown;
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}

interface PendingQuestion {
  kind: 'question';
  runId: string;
  toolCallId: string;               // ask_user tool's call id
  question: string;
  options?: { label: string; description?: string }[];
  selectionMode?: 'single_select' | 'multi_select';
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}

interface PendingPlanApproval {
  kind: 'plan-approval';
  runId: string;
  toolCallId: string;               // submit_plan tool's call id
  title: string;
  plan: string;                     // markdown body
  source: 'parent' | 'subagent';
  subagentToolCallId?: string;
  requestedAt: number;
}
```

Transient runtime state (`AbortController`, in-flight model-call promises, SSE listeners, the live `DisplayStateScheduler`, the `pendingApprovalResolve` callback) is **not** persisted. It's reconstructed when a record is hydrated; pending suspensions are resumed by handing `runId` back to `agent.resumeStream(...)` / `agent.resumeGenerate(...)`.

**Serialization contract.** Every field on `SessionRecord` must be JSON-serializable. The shapes above are deliberately closed: no functions, no class instances, no `Map`/`Set`/`Date` objects (use ISO strings or epoch numbers, as shown). Inline-form file attachments are normalised to `PersistedAttachment` references before they reach the record. The non-serialisable per-turn override (`addTools`) does not appear on `QueuedItem` because `queue(...)` rejects it at admission rather than dropping it silently after the fact — see §4.3 and the comment on `QueuedItem` above.

**`state: TState` constraint.** The user-defined `state` slot must round-trip through `JSON.stringify` / `JSON.parse`. The harness validates this on every flush and rejects non-serializable values with `HarnessStateSerializationError`. Recommended: keep `state` small (rule of thumb: under 64 KiB). Large blobs belong in workspace files, file attachments, or your own datastore — referenced from `state` by ID.
