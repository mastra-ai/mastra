### 9.5 Config Validation

Config validation happens during `harness.init()`. `agents` and `modes` must be
non-empty. Mode IDs must be unique; at most one mode may set `default: true`,
and if none does, `modes[0]` is the bootstrap default. Every mode's `agentId`
must reference a key in `agents`. When exactly one agent is configured, an
omitted `agentId` is normalized to that single agent before sessions, routes, or
workers start; when more than one agent is configured, omitted or unknown
bindings throw `HarnessConfigError`. Multiple modes may intentionally reference
the same agent.

Legacy mode definitions that embed a live `Agent` object or a state-dependent
agent factory are compatibility inputs only. A v1 compatibility adapter may
derive stable agent registry entries from them during `harness.init()`, but
sessions, routes, workers, run starts, hydration, and queue drain must see only
`HarnessConfig.agents` entries and `HarnessMode.agentId` bindings. After init,
the harness must not call a mode-local factory, inspect generic session state
to choose an agent object, or treat a live `Agent` reference as a committed run
surface.

Model IDs are opaque non-empty strings resolved by `resolveModel(...)`.
`harness.init()` validates static configured defaults that can seed future
session or judge state before any caller supplies a runtime override:
`defaultModelId`, every `HarnessMode.defaultModelId`, and
`goals.defaultJudgeModel` when present. Validation means the resolver accepts
the ID and returns a `LanguageModel`; a resolver throw, missing return, or
non-model return is wrapped as `HarnessConfigError`. Catalog membership is not
the validity boundary: `listAvailableModels()` is an advisory discovery/status
surface and may omit resolvable dynamic aliases. API-key or OAuth availability
is also not config validity; `getCurrentModelAuthStatus()` and model-call
failures report runtime availability without making `init()` fail for a missing
credential. Runtime model choices (`session.switchModel(...)`,
`session.setSubagentModel(...)`, observational-memory model switches,
`setGoal({ judgeModel })`, per-turn `model` overrides from direct or channel
admission, and explicit subagent tool model arguments) validate before their
durable commit, queue append, signal admission, or tool-run start. A queued
model override that was valid when appended is re-resolved before drain or
recovery; resolver drift after admission fails the owning operation closed
rather than silently retargeting. If `message(...)` would drain into an already
active run and carries an unusable `model` override, the override conflict is
reported before resolving a model that cannot affect that run.

When a run starts, the successful resolver return is the model supplied to the
selected Agent execution; recording a model ID in state, thread metadata, or an
event is not sufficient.

For `sessions` lease timing:
`lockTtlMs` must be finite and positive; `lockRenewMs` must be finite, positive,
and strictly less than `lockTtlMs`; `lockWaitMs` and `flushDebounceMs` must be
finite and non-negative; `closeTimeoutMs` must be finite and positive; and
`maxFlushFailures` must be a positive integer.
`lockWaitMs` is only a caller-side wait budget and is not compared to
`lockTtlMs`; a zero value means one immediate acquisition attempt with no sleep.
`flushDebounceMs` is not compared to `lockRenewMs` because keep-alive renewal
owns lease liveness while flush renewal is opportunistic; redundant same-owner
renewals are harmless. If storage adapters do not use storage-authoritative time
for session lease expiry, `sessions.maxClockSkewMs` is required. Whenever
configured, `sessions.maxClockSkewMs` must be finite, non-negative, and less
than `lockTtlMs - lockRenewMs`. `closeTimeoutMs` is not compared to `lockTtlMs`:
bounded close uses a fixed storage-time `closeDeadlineAt` and renews the lease
only to preserve write authority until that deadline, never to extend it.

For `backgroundTasks`, every executor and completion-policy key must be a
non-empty stable id unique within its registry. `executorRef.id` and
`completionPolicyRef.id` on §5.1 `BackgroundTaskReconstructableRow` rows resolve
only through these registries. When a row stores a generation, the currently
registered entry must carry the same generation; a missing entry, wrong kind,
generation mismatch, invalid row-level completion metadata, or unavailable tool
surface is runtime dependency drift (§5.7). `claimRenewMs` must be finite,
positive, and strictly less than `claimTtlMs`; `pollIntervalMs` must be finite
and positive; and `batchSize` must be a positive integer. These worker settings
do not define terminal-row TTLs; terminal background-task rows remain governed
by the source-specific retention deferral above and §15.3.

For `lists`, every configured `defaultLimit` and `maxLimit` must be a positive
integer, and every effective `defaultLimit` must be less than or equal to its
effective `maxLimit`. Invalid pagination config throws `HarnessConfigError` at
`init()`. A caller-supplied `limit` above the effective maximum rejects with the
normal validation error instead of being silently reduced; this keeps SDK and
wire clients from mistaking a truncated page for the requested page size.

For `files`, configured byte and duration values must be finite and positive,
and `maxUrlRedirects` must be a non-negative integer. In particular,
`stagedAttachmentRetentionMs` is an eligibility window for unreferenced staged
bytes, not a retention deadline for attachments still referenced by queue,
message-history, current-run, channel inbox, wakeup, or outbox state.

For every channel `inbox`, `actions`, `outbox`, top-level `wakeups`, and
top-level `backgroundTasks` recovery config: `maxAttempts` must be at least `1`;
`batchSize` must be positive; `claimTtlMs` must be positive; `claimRenewMs` must
be positive and strictly less than `claimTtlMs`; any `pollIntervalMs` must be
positive and less than `claimTtlMs`; and `retryBackoffMs(attempt)` must return a
finite non-negative delay. If storage adapters do not use storage-authoritative
time for claim expiry, `maxClockSkewMs` is required and must be less than
`claimTtlMs - claimRenewMs`. Invalid relationships throw `HarnessConfigError`
before routes or workers start.
Channel adapter delivery plans are validated at the same boundary: static
`deliverySemantics` and `deliverySemanticsByOperation` values must use the known
mode vocabulary, and any adapter that can snapshot `lookup-reconcile` for a row
must provide `reconcileDelivery(...)` for the stored operation. A delivery plan
with `operationKind: 'custom'` must include a stable `operationName`.

---
