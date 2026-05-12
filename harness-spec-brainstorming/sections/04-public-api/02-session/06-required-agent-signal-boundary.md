### 4.2f Required Agent Signal Boundary

`Session.message(...)`, untyped `useSkill(...)`, and drained `queue(...)` rely
on an internal agent boundary. It is not exposed to remote clients, but an agent
implementation that cannot satisfy it cannot support Harness v1's independent
per-signal `message(...)` promises.

```ts
interface AgentSignalBoundary {
  sendSignal(input: AgentSignalInput): Promise<AgentSignalAccepted>;
  getSignalResult(input: AgentSignalResultLookup): Promise<AgentSignalResultStatus>;
  subscribeSignalResults?(
    input: AgentSignalSubscription,
    listener: (event: AgentSignalTerminalEvent) => void,
  ): () => void;
}

interface AgentSignalInput {
  harnessName: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  content: string;
  attachments: PersistedAttachment[];
  requestContext?: PersistedRequestContextInput;
  admissionId?: string;
  admissionHash?: string;
  source:
    | { kind: 'message' }
    | { kind: 'queue'; queuedItemId: string }
    | { kind: 'use-skill'; skillName: string };
  // Present only when the signal is intended to drain into an already-active
  // run. When absent, the agent starts a new run using the committed run
  // surface selected by the session owner: the effective mode resolves to a
  // stable `HarnessMode.agentId`, the effective opaque model ID resolves
  // through `HarnessConfig.resolveModel(...)`, and `currentRun.agentId` /
  // `modeId` / `modelId` are committed before the selected Agent is invoked
  // with the resolved model. The run-boundary overrides below (`model`,
  // `mode`, `yolo`) are populated only when `runId` is absent;
  // admission rejects `yolo: true` before a runId-bearing active signal reaches
  // this boundary.
  runId?: string;
  model?: string;
  mode?: string;
  yolo?: boolean;
  tracingContext?: TracingContext;
  tracingOptions?: TracingOptions;
}

interface AgentSignalAccepted {
  runId: string;
  signalId: string;
  duplicate: boolean;
}

interface AgentSignalResultLookup {
  harnessName: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  signalId: string;
}

interface AgentSignalSubscription {
  harnessName: string;
  sessionId: string;
  resourceId: string;
  threadId: string;
  signalIds?: string[];
}

type AgentSignalResultStatus =
  | { status: 'pending'; signalId: string; runId?: string }
  | { status: 'completed'; signalId: string; runId: string; result: AgentResult }
  | { status: 'failed'; signalId: string; runId?: string; error: { code: string; message: string } };

type AgentSignalTerminalEvent = Extract<AgentSignalResultStatus, { status: 'completed' | 'failed' }>;
```

`sendSignal(...)` is the post-acceptance durability boundary named in §5.7.
When `admissionId` is present, an exact duplicate with the same
`admissionHash` returns the original `{ runId, signalId, duplicate: true }`
without accepting a second signal. The same `admissionId` with a different hash
fails before new work is admitted and surfaces as `HarnessAdmissionConflictError`
at the session/API layer. `admissionHash` is computed by the session owner from
the normalized operation inputs defined in §4.4; the agent boundary compares the
hash, but does not invent a second hashing algorithm.

`getSignalResult(...)` and, when implemented, `subscribeSignalResults(...)`
report operation-scoped terminal status by `signalId`. A completed result is the
answer attributable to that accepted signal, not the whole run's aggregate
output; a failed result is terminal for that signal. Run-level `agent_end`,
run-level `error`, stream close, eviction, shutdown, and session lifecycle
events are inspection/display signals only and never settle a specific
`signalId`. If full result evidence has compacted while an
`OperationAdmissionTombstone` remains, Harness result routes return the `expired`
wire state from the tombstone (§13.3) rather than calling `sendSignal(...)`
again or treating the operation as pending.

The write side for terminal signal evidence is the retained result-correlation
record required by §5.1 and the recovery/lifecycle terminalization path in
§5.7. `AgentSignalBoundary` intentionally exposes admission, lookup, and
optional subscription; it does not define a separate public terminal-write
method, and forced failure writes must still update the same evidence projected
by `getSignalResult(...)`.
