### 11.4 Method translation table

The table below maps each method on the legacy `Harness` to its new `Harness` +
`Session` equivalent (i.e. the `@mastra/core/harness/v1` API).

These mappings are caller migration guidance, not implementation aliases.
Legacy run-scoped `Harness` methods and current `DurableAgent` run-topic APIs
may be compatibility inputs or adapter building blocks only; they do not satisfy
v1 `Session` operation semantics unless wrapped behind the §4.2 signal/resume
boundaries and the §5.7 recovery/result contracts. Process-local
abort/follow-up/pending resolvers, run-level stream events, and `runId`-only
resume calls cannot stand in for `signalId`, `queuedItemId`,
`InboxResponseReceipt`, `resumeAttemptId`, or retained result/tombstone
evidence. A legacy method mapped to a v1 method does not imply the old method
can back the new method without the v1 session, signal, lease, receipt, and
channel bridge contracts described in §3, §4.2, §5.7, §5.8, and §14.
The same rule applies to legacy thread-selection helpers: `currentThreadId`,
`selectOrCreateThread()`, `createThread()`, `switchThread()`,
`sendMessage(...)` auto-thread creation, and `threadLock` are compatibility
inputs or internal primitives only. They do not prove active-session ownership;
opening an existing thread enters the §5.3 `harness.session({ threadId,
resourceId })` / `createOrLoadActiveSession(...)` resolver, including
resource-mismatch masking, closing-row rejection, closed-thread fresh-session
reuse, active lease acquisition, deterministic `sessionId` conflict checks, and
direct-ID active-key corruption checks.

**`harness.sendMessage(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): `session.message(...)` by
default; use `session.queue(...)` only when the caller needs a sequential
standalone turn. See §3 and §4.2.

**`harness.getCurrentThreadId()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): `session.threadId`

**`harness.switchThread({ threadId })`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`harness.session({ threadId, resourceId })` through the §5.3 resolver, not by
assigning a process-local current thread.

**`harness.getState()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): `session.getState()` for
caller intent only. This is not an implementation alias: legacy reads return a
process-local Harness snapshot, while v1 reads a detached snapshot of the latest
committed `SessionRecord.state` (§4.2/§5.1/§6.2).

**`harness.setState(updates)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`session.setState(updates)` for object-form caller intent. This is not an
implementation alias: legacy writes shallow-merge into process-local Harness
state and emit immediately, while v1 writes validate JSON/lossless state, commit
through `SessionRecord.state` under the lease/version boundary, emit
`state_changed` only after durable success, and also support local/tool
functional `setState(prev => next)` (§5.1/§5.8/§10.2).

**`harness.switchMode({ modeId })`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`session.switchMode({ mode })`

**`harness.switchModel({ modelId })`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`session.switchModel({ model })`

**`harness.switchModel({ modelId, scope: 'global' })`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): *removed* — use
`session.switchModel(...)` for session-level changes. Future session bootstrap
defaults come from `HarnessConfig.defaultModelId`; see §9.

**`harness.subscribe(listener)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`session.subscribe(listener)` (or `harness.subscribe` for cross-session) for
caller intent only. This is not an implementation alias: legacy listeners
receive the legacy `HarnessEvent` union, including legacy-only display
notifications, while v1 subscriptions receive only the projected §10
`HarnessEvent` surface with the §10.1 base envelope, the §10.2 display-event
exclusion, and the §10.5 ring-buffer / `Last-Event-ID` replay rules for session
SSE.

**`harness.getDisplayState()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`session.getDisplayState()`

**`harness.abort()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): *removed* — cancellation
is not a session concern; see §3.

**`harness.steer(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): *removed* — use
`session.message(...)` for new content. Abort-first behavior remains an
agent-layer concern; see §3.

**`harness.followUp(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): `session.message(...)` by
default, or `session.queue(...)` for sequential turns; see §3 and §4.2.

**`harness.isRunning()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): `session.isBusy()` for
caller intent only. This is not an implementation alias: legacy checks a
process-local `AbortController`, while v1 reads the owning session's
live/reconciled idle boundary from `currentRun`, canonical pending items, and
`SessionRecord.pendingQueue` (§4.2).

**`harness.getFollowUpCount()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): `session.getQueueDepth()`
only when the caller meant durable queued standalone turns. Legacy follow-up
count reads an in-memory retry/follow-up buffer; v1 queue depth is
`SessionRecord.pendingQueue.length` under the active session owner (§4.2/§5.1).

**`harness.getCurrentRunId()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`session.getCurrentRunId()` for caller intent only. V1 reconciles live agent
state with `SessionRecord.currentRun` after hydration and returns `null` when no
pending item or agent-layer liveness proves a still-live run (§4.2/§5.7).

**`harness.getCurrentTraceId()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`session.getCurrentTraceId()` for caller intent only. V1 follows the same
live-or-reconciled `SessionRecord.currentRun` projection as `getCurrentRunId()`
(§4.2/§5.7).

**`harness.getTokenUsage()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): `session.getTokenUsage()`
for caller intent only. Legacy returns a process-local accumulator best-effort
mirrored to thread metadata; v1 returns the session-owned token-usage projection
hydrated from `SessionRecord.tokenUsage`, with legacy
`thread.metadata.tokenUsage` only as §11.2 bootstrap/compatibility input.

**`harness.getWorkspace()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): `harness.getWorkspace()`
for out-of-session shared contexts only. This is not an implementation alias:
legacy returns the singleton cached workspace, static or resolved from
`workspaceFn`, while v1 returns the configured `shared` workspace or `undefined`
for `per-resource` / `per-session` shapes. Runtime callers use
`session.getWorkspace()` / `session.resolveWorkspace()` through the owning
session resolver (§2.7/§4.1).

**`harness.resolveWorkspace()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`harness.resolveWorkspace()` for out-of-session shared contexts only. This is
not an implementation alias: legacy resolves a single `{ requestContext }`
factory result and caches it globally, while v1 resolves through the
ownership-model resolver described in §2.7. `per-resource` and `per-session`
workspaces are resolved from a `Session` or `HarnessRequestContext`, not from a
global harness cache.

**`harness.destroyWorkspace()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): Replaced by shape-specific
teardown: `harness.shutdown()` for `shared`, `session.close()` /
`harness.closeSession(...)` for `per-session`, and
`harness.destroyResourceWorkspace({ resourceId })` for `per-resource`. The
per-resource path must check persisted active sessions and fence concurrent
creation as described in §4.1.

**`harness.memory.createThread(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`harness.threads.create(...)`

**`harness.cloneThread(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`harness.threads.clone(...)` for caller intent only. This is not an
implementation alias: legacy clone may infer the source from the active thread,
accept a destination `resourceId`, switch active thread/lock/token state, and
route through broader `Memory.cloneThread(...)` behavior. V1
`threads.clone(...)` is the same-resource, side-effect-free thread/message
snapshot described in §4.4; legacy clone-and-switch callers must explicitly
clone, then open a session for the cloned `threadId` if they want to continue
there.

**`harness.memory.deleteThread(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`harness.threads.delete({ threadId, resourceId })` for caller intent only. This
is not an implementation alias: legacy/current delete paths perform direct
physical thread/message/vector cleanup without the §5.5 session
close/force-delete cascade, descendant walk, dependent-ledger terminalization,
or thread-scoped OM cleanup. V1 `threads.delete(...)` runs the full §5.5
lifecycle first and uses raw memory deletion only as a final physical cleanup
step.

**`harness.listThreads(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`harness.threads.list(...)`

**`harness.renameThread({ title })`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`harness.threads.rename({ threadId, resourceId, title })`

**`harness.grantSessionCategory(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`session.permissions.grantCategory(...)`

**`harness.grantSessionTool(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`session.permissions.grantTool(...)`

**`harness.setPermissionForCategory(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`session.permissions.setPolicy({ category, policy })`

**`harness.setPermissionForTool(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`session.permissions.setPolicy({ toolName, policy })`

**`harness.getObservationalMemoryRecord()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): `session.om.getRecord()`
for caller intent only. This is not an implementation alias: legacy/current
reads may return the raw `ObservationalMemoryRecord`, while v1 returns only the
§4.8 `ObservationalMemorySnapshot` after session/resource/scope verification and
redaction.

**`harness.switchObserverModel(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`session.om.switchObserverModel({ model })` for caller intent only. This is not
an implementation alias: legacy/current switches may use `{ modelId }`,
process-local state, top-level thread metadata, or pre-commit events; v1 commits
`SessionRecord.observationalMemory` under the session
lease/version/authorization boundary and emits only after durable success.

**`harness.switchReflectorModel(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`):
`session.om.switchReflectorModel({ model })` with the same caller-intent-only
boundary as observer model switching.

**`harness.registerHeartbeat(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): `harness.onInterval(...)`
(returns async unsubscribe)

**`harness.removeHeartbeat({ id })`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): await the unsubscribe
function returned by `onInterval`

**`harness.stopHeartbeats()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): `harness.stopIntervals()`

**`harness.getModelName()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): *removed* — no v1
equivalent. `session.getCurrentModelId()` returns an opaque model ID;
applications that need display labels own that catalog and may consult advisory
`harness.listAvailableModels()` when the ID appears there (§4.1, §9).

**`harness.getFullModelId()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): *removed* — use
`session.getCurrentModelId()` (§4.2).

**`harness.getResolvedObserverModel()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): *removed* — trivial
composition

**`harness.getSession()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): *removed* — name collides
with new `Session`

**`harness.selectOrCreateThread()`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): *removed* — use
`harness.session({ resourceId })`; resource-only startup follows §5.3's
most-recent-active-session rule, not legacy thread `updatedAt` selection.

**`harness.setResourceId(...)`**

v1 `Harness` + `Session` (`@mastra/core/harness/v1`): *removed* — set at session
creation


The permission rows above are caller-intent mappings, not implementation
aliases. Legacy grant and policy helpers may be compatibility inputs only; they
do not satisfy v1 unless they commit `SessionRecord.sessionGrants` /
`SessionRecord.permissionRules` under the active session lease/version boundary
and remote callers first pass the §13.2 `harness:permission-admin` capability.
Revokes, explicit `ask`, pending-approval separation, subagent
non-inheritance, and deny-before-grant/yolo precedence remain owned by §4.2 and
verified by §15. Runtime gate placement and additive approval-source
composition remain tracked separately by HC-320 and HC-322.

The heartbeat rows above are caller migration guidance, not implementation
aliases. A compatibility adapter may accept legacy `heartbeatHandlers` or
`HeartbeatHandler.intervalMs`, but it must normalize them to §9
`intervals` / `IntervalHandler.ms` before registration. V1 interval semantics
also differ from current heartbeats: `immediate` defaults to `false`; duplicate
configured or runtime IDs reject instead of silently skipping or replacing a
live handler; invalid IDs, non-positive intervals, and non-function handlers
reject at init or `onInterval(...)`; slow async ticks skip later ticks for the
same interval ID rather than overlapping; and unsubscribe, `stopIntervals()`,
and shutdown await any in-flight handler before calling the interval shutdown
hook. These process-local intervals remain separate from durable recurring
work, which uses `HarnessWakeupItem` rows as described in §11.5, §14.6, and
§15.

**Skill compatibility surfaces.** The legacy Harness has no public
`useSkill(...)`, `listSkills()`, `getSkill(...)`, `refreshSkills()`, or
code-registered `HarnessConfig.skills` equivalent. Those APIs are new v1
Session/Harness surfaces owned by §4.6, not method aliases over the legacy
`@mastra/core/harness` export.

**Core `Workspace.skills` / `WorkspaceSkills`**

v1 boundary: Implementation material for the workspace side of §4.6 resolution.
V1 session skill methods delegate to the resolved session workspace's configured
`WorkspaceSkills` source/resolver for workspace-owned skills, after
code-registered skills have taken precedence.

**Model-facing `skill` activation tool**

v1 boundary: Compatibility surface. If exposed for a v1 session, activation must
resolve through the same dual-source catalog as `session.useSkill(...)` so host
callers and the model do not see different skill availability. It injects
instructions into the model turn; it is not a replacement for the caller-facing
`session.useSkill(...)` operation.

**Model-facing `skill_search` / `skill_read` tools**

v1 boundary: Workspace-owned compatibility helpers. They may continue to
search/read the workspace skill source because code-registered skills do not
have a required `references/`, `scripts/`, or `assets` filesystem layout. They
must omit or gracefully reject code-registered skills rather than implying those
skills are unavailable to `session.useSkill(...)`.

**`SkillsProcessor` / `SkillSearchProcessor`**

v1 boundary: Processor-framework compatibility. If a v1 agent keeps them for
eager or on-demand model prompting, any catalog or activation claim must be
aligned with the §4.6 session resolver; otherwise the product must document them
as workspace-only processor behavior outside the public Harness skill API.

**Current processor `listSkills()` server exposure**

v1 boundary: Compatibility read model only. V1 public skill reads are
`harness.listSkills()` for code-registered deployment skills and
`session.listSkills()` / `session.getSkill(...)` for the resolved session
catalog.
