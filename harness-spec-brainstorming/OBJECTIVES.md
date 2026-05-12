# Objectives

## Source Preservation

- Keep `sections/` as the source of truth for Harness v1 brainstorming.
- Let git track changes to the section files and local process docs.

## Audit Semantics

- Treat recorded issue outcomes and section text as the audit trail for Harness v1: accepted into the contract, explicitly deferred with a safe fallback, or rejected by narrowing v1 scope. These outcomes do not mean Mastra implementation packages have already been changed.
- Preserve explicit v1 deferrals recorded in the issue tracker, §11.5, and §15.3 unless the user intentionally reopens scope with council review and a replacement accepted, deferred, or rejected outcome.

## CLI Council Accuracy

- Use `HOW_TO_USE_CLIS.md` as the source of truth for the required reviewer set, model selectors, prompt shape, and decision rule.
- Require each council member to cite exact split files before recommending a change.
- Prefer justified diffs over broad commentary.
- Treat unsupported claims as unresolved until the orchestrator verifies them against the spec.
- Keep raw council output transient unless the user asks to preserve it.

## Harness Fit

- Preserve the Harness/Session separation: Harness as restartable process-local
  orchestration infrastructure that does not own durable per-conversation state,
  Session as the per-conversation runtime hydrated from storage.
- Preserve tenant isolation through `resourceId` checks and non-leaking not-found behavior.
- Preserve the concurrency model: `message` drains through signals, `queue` remains durable FIFO, and sync structured output stays fail-fast.
- Preserve persistence, workspace ownership, event ordering, subagent guarantees, and remote-safe API boundaries unless the relevant section spec is intentionally revised.
- Preserve channel guarantees by requiring channel ingress to resolve a Harness Session before runtime admission, channel actions to answer Harness inbox items, and channel outbound to use durable outbox records with snapshotted delivery semantics rather than relying solely on live stream consumers for delivery.
- Preserve multi-harness/channel coordination: Mastra Server must have a central registry/router that knows all registered harnesses, channel providers, and configured harness-channel pairs at init time, so X harnesses can safely share Y channel providers without ambiguous routes or hidden ownership. Persisted `ChannelBinding` rows are owned by those pairs and may be loaded lazily, but their namespace must be unambiguous.
- Validate spec claims against current Mastra code when a section references existing behavior. Depending on the referenced behavior, relevant in-scope paths include `packages/core/src/channels`, `packages/core/src/storage/domains/channels`, `packages/core/src/workflows/scheduler`, `packages/core/src/storage/domains/schedules`, `packages/core/src/agent/durable/evented-agent.ts`, `packages/core/src/background-tasks`, `packages/core/src/events`, `packages/core/src/mastra/index.ts`, and any other current-code path the section under review explicitly names; keep `examples/` and `reference/` out of scope unless the user explicitly asks for them.

## Verification Discipline

- Treat §15.1 failure invariants as authoritative checkpoints for Harness durability promises. A proposed change that relaxes or contradicts a boundary, record, or promise in the invariant table is a contract regression unless the relevant section is intentionally revised.
- Treat §15.2 focused test-plan entries as minimum implementation-acceptance coverage. A change that introduces a new durability path must add a corresponding failure-mode test-plan entry or explicitly document a deferral.
- Preserve the source-specific ledger pattern for future retrying or autonomous external sources. Do not introduce a generic `IntegrationInbox`, `IntegrationOutbox`, or `ActionReceipt` v1 surface without intentionally reopening that deferred scope.

## Diff Discipline

- One orchestrator writes the final change.
- Every accepted change should map to a source section, an issue claim or recorded outcome, and an objective; durability changes should also map to §15.1, §15.2, or §15.3.
- Edit section files directly.
- Prefer minimal section fixes over broad redesign. Do not add new Harness concepts,
  storage records, APIs, events, routes, or terms unless an existing section element
  cannot correctly own the responsibility.
- When concepts overlap, choose the canonical owner, update that section, and add
  references from dependent sections instead of maintaining parallel definitions.
- Rejected alternatives do not need a persistent artifact unless the user asks for one.

## Iteration Discipline

- Gather full council whenever a substantive Harness v1 spec or process element is debated, including changes to contracts, storage shapes, recovery behavior, APIs, event channels, scheduler behavior, runtime semantics, server integration, migration guarantees, deferrals, or invariants.
- Re-run council when scope changes materially, reviewers disagree on a contract-level interpretation, or a high-risk diff needs a second pass.
- Let the orchestrator handle small verified editorial follow-ups directly when no technical claim changes.
- Prefer narrow checks over repo-wide checks.

## Mastra Primitive Reuse Discipline

Before introducing a new Harness concept, storage record, API, worker,
scheduler, replay primitive, callback binding, suspension primitive, runtime
context method, or subagent runtime, verify that no existing Mastra primitive
already owns the responsibility. Required first read for any new-vs-existing
claim: `sections/11-migration-from-current-harness/06-current-vs-v1-status-ledger.md`
(the spec's own current-vs-v1 ledger; it already classifies every declared
class/interface/type name against `packages/core/src/...` paths). Required
search: `rg` the full `sections/` tree for citations of the candidate Mastra
path before claiming "the spec does not cite primitive X" — `sections/14-*`,
`sections/13-*`, and `sections/06-*` frequently carry load-bearing citations
that `sections/05-*` does not repeat.

The current Mastra primitives most commonly mistaken for Harness gaps:

- Scheduling: `packages/core/src/storage/domains/schedules/` (`Schedule`,
  `ScheduleTrigger`, `updateScheduleNextFire` CAS) and
  `packages/core/src/workflows/scheduler/` (tick + claim loop).
  Current `Schedule.target` is workflow-only and `cron` is required; the
  scheduler publishes `workflow.start` on pubsub. `HarnessWakeupItem` is the
  durable single-fire/admission row for non-cron or channel-bound work
  (§14.6 already documents this).
- Background work: `packages/core/src/background-tasks/`
  (`BackgroundTask` row, `BackgroundTaskManager` claim/concurrency/retry/
  cleanup/backpressure). Current manager uses pubsub consumer-group dispatch
  over in-memory `TaskContext` closures; storage adapter has no `claim*` /
  renew / CAS API. Harness reconstructable rows extend the row shape with
  `executorRef`, `completionPolicyRef`, `runtimeCompatibilityGeneration`, and
  storage-level claim metadata.
- Event ordering and replay: `packages/core/src/events/pubsub.ts`,
  `packages/core/src/events/event-emitter.ts`,
  `packages/core/src/events/caching-pubsub.ts` (`Event.index`, `getHistory`,
  `subscribeWithReplay`, `subscribeFromOffset`, `deliveryAttempt`,
  `CachingPubSub`). Pubsub stream IDs/topic offsets/cache history are
  implementation inputs to the §10 event adapter, not v1 event IDs or replay
  cursors; the `<epoch>-<seq>` ID and ring-buffer + `412` contract is
  Harness-owned because the cache-backed replay paths do not own the SSE
  epoch/`Last-Event-ID`/overflow/stale-cursor contract (§10.5:53-65 already
  states this).
- Storage domain abstraction: `packages/core/src/storage/domains/base.ts`
  (`StorageDomain`, `getStore`) — new Harness domains follow this shape.
- Channel callbacks and routes: `packages/core/src/channels/types.ts`
  (`ChannelProvider`, `ChannelProvider.getRoutes()`),
  `packages/core/src/channels/agent-channels.ts` (`AgentChannels` live route
  surface),
  `packages/core/src/storage/domains/channels/base.ts`
  (`ChannelInstallation.webhookId` for single-agent webhook routing). Note:
  `packages/core/src/channels/base.ts` does not exist — use
  `channels/types.ts` and `storage/domains/channels/base.ts`.
- Subagent delegation: `packages/core/src/agent/agent.ts` (`NetworkOptions`,
  `agent.network()`, agent-as-tool execution),
  `packages/core/src/agent/agent.types.ts` (`DelegationConfig`),
  `packages/core/src/mcp/index.ts` (agent-as-tool exposure),
  `packages/core/src/loop/network/`. These operate within a single turn's
  tool-calling lifecycle. Harness child sessions are durable `SessionRecord`
  rows under §5.6.
- Tool/step suspension: `packages/core/src/workflows/step.ts` (`SuspendOptions`,
  `suspend()`, `WorkflowRunState` snapshot, `RestartExecutionParams`).
  Authoritative paused execution state lives in `MastraStorage.workflows`
  keyed by `runId` (§5.1f:22-29); Harness `PendingToolSuspension` is the
  inbox/UX projection, not a parallel execution snapshot.
- Memory and threads: `packages/core/src/storage/domains/memory/`
  (`StorageThreadType`, `MastraDBMessage`, observational memory).
- Skills: `packages/core/src/workspace/skills/`
  (`Skill`, `WorkspaceSkills`, `SkillSource`, `SkillsContext`,
  `SkillMetadata`) — Mastra core already has a Skill primitive. Harness
  skills (§4.6) layer Session+Workspace resolution on top of `WorkspaceSkills`.
- Agent stream / signal model: `packages/core/src/agent/agent.ts` and
  `packages/core/src/agent/durable/evented-agent.ts`.
- Concurrency: storage-fenced CAS (`updateScheduleNextFire`, workflow
  `supportsConcurrentUpdates`) plus the Harness session-lease layer with
  `lockMode: 'fail' | 'wait' | 'steal'` (§5.8). The `steal` policy is
  CAS-compatible (force-acquire by bumping `version`); it is reserved for
  operator tools, must emit an audit event, and is not exposed on
  `RemoteSession`/SDK paths.
- Request context: `packages/core/src/request-context/` (typed slot container
  with reserved keys). Harness extends `RequestContext` by populating the
  `'harness'` slot (§6.0:8-10), reachable via
  `context.requestContext.get('harness') as HarnessRequestContext`. This is
  the slot pattern, not a replacement type — tools authored against the slot
  remain portable.
- Server routes and client SDK: `packages/server/` (`SERVER_ROUTES`
  registry, generated route types) and `client-sdks/client-js/`
  (`MastraClient`). `/harness/*` routes participate in `SERVER_ROUTES`;
  `MastraClient.getHarness(name)` is a v1 addition on the existing client.

A spec change that introduces a new primitive without first consulting §11.6,
running the `rg` citation check, and citing the existing primitive is treated
as drift and rejected at council. A spec change that extends an existing
primitive is preferred over a parallel Harness primitive whenever the existing
primitive can carry the responsibility under documented invariants. If no
existing Mastra primitive owns the responsibility, the issue must document
the gap explicitly and state why a new Harness-only primitive is needed for v1
(e.g. `runtimeCompatibilityGeneration` as an operator-controlled config-change
fence has no Mastra-core counterpart and is justified in §9.1 / HC-124).

## Internal Authority Discipline

When a Harness fact, identity, or state is recorded in more than one place,
declare a single authority and add cross-references from dependents rather than
maintaining parallel rows. A spec that records the same fact in two authorities
without naming a primary is treated as a contradiction. Before claiming a
duplication, verify that the spec does not already declare the authority —
many apparent duplications in `sections/05-*` are read projections
(`SessionSnapshot`, `SessionActivityTimeline`, `currentRun.pendingItems[]`),
not persisted authorities, and the rebuild rules are typically documented in
the owning section. Known authority cases (with primaries cited):

- Queue continuation: `QueueAdmissionReceipt` owns post-creation retry,
  reconciliation, terminal settlement, and duplicate handling
  (§5.1d:148-158). `GoalState.lastDecision` provides the deterministic
  `admissionId` bridge but does not duplicate the receipt.
- Pending item identity: typed `pendingApproval` / `pendingSuspension` /
  `pendingQuestion` / `pendingPlan` fields on `SessionRecord` are
  authoritative; `currentRun.pendingItems[]` is rebuilt from those on
  hydration (§5.1e:262-272). First-party `PendingInboxItem` is a projection,
  not a fifth persisted record.
- Channel action token vs receipt: `token_expired` / `token_revoked` are
  first-use conflict reasons only; they do not relabel durable
  `ChannelActionReceipt` rows (§14.5:112-130, §5.7c:123-134).
- Display state: only `SessionRecord.displayState` is persisted;
  `SessionSnapshot.displayState` and `SessionActivityTimeline` are read
  projections (§5.1c:40-48) with per-field rebuild rules (§5.1a.2).
- Admission retention: `admissionTombstoneRetentionMs >=
  admissionReceiptRetentionMs` is explicitly ordered at §9.1:142-143.
- Goal judge: assistant-turn decisions live on `GoalState.lastDecision`
  (`done | continue | waiting`); question auto-answers live on
  `InboxResponseReceipt.goalJudge`. These are different decisions, not
  parallel records of the same fact.
- Workspace lost flag (open issue HC-116): `SessionRecord.workspace.lostAt`
  is the authoritative loss marker; rehydration must check `lostAt` before
  reading `state`/`generation`. Lost-marker-wins, sticky across saves,
  cleared only by operator repair.
