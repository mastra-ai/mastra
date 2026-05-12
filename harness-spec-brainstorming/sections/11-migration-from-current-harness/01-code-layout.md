### 11.1 Code layout

```
packages/core/src/harness/
├── index.ts                 # subpath: '@mastra/core/harness'
│                            # exports `Harness` = the existing implementation
├── harness.ts               # the existing implementation, unchanged
├── tools.ts                 # ... existing files, unchanged
├── display-state-scheduler.ts
├── ...
└── v1/
    ├── index.ts             # subpath: '@mastra/core/harness/v1'
    │                        # exports `Harness` = the new implementation
    ├── harness.ts           # new `Harness` class (the registry/factory side)
    ├── session.ts           # `Session` class
    ├── shared.ts            # re-exports stable types from ../ when shape matches
    └── ...
```

The source file `packages/core/src/harness/v1/index.ts` alone is not sufficient
to ship the `@mastra/core/harness/v1` subpath. The same implementation change
must add a `./harness/v1` entry to `packages/core/package.json` that mirrors the
legacy `./harness` export shape for ESM, CJS, and TypeScript declaration
targets, and must add an explicit nested build entry or otherwise prove that
the package build emits `dist/harness/v1/index.js`,
`dist/harness/v1/index.cjs`, and `dist/harness/v1/index.d.ts`. Runtime JS/CJS
emission and declaration emission may be owned by different build steps; the
declaration-generation path (`@internal/types-builder` or any replacement) must
be verified for the nested entry before the package export is considered
shipped. The legacy `./harness` export remains pointed at the existing
implementation throughout `@mastra/core` v1.

Stable interfaces (`HarnessMessage`, `HarnessMode`, `HarnessStorage`, workspace
types) are re-exported from both subpaths and back the same underlying
definitions wherever shapes align. When the v1 API needs a shape change (for
example, `HarnessRequestContext` gaining required fields per §6.1), the new
shape lives in `v1/` and the old shape stays under the legacy subpath untouched.
There is no shared base class and no runtime shim.

The legacy `@mastra/core/harness` request-context construction is compatibility
material, not a v1 runtime-slot boundary. Its current pattern of writing
`requestContext.set('harness', ...)` onto the object passed into a run may
remain
behind the legacy subpath, but a v1 wrapper or replacement must rebuild the
§6.1 `HarnessRequestContext` for each tool execution on a detached context or
overlay, reject caller-supplied top-level `harness`, and persist only the §5.1
`PersistedRequestContextInput` subset.

The current generic Mastra tool context, current `createMastraProxy`-backed
agent/tool conversion, and current `context.mastra.getStorage()` tool-authoring
example are also compatibility material only. They are not the v1 Harness tool
boundary unless wrapped by the §6 Harness-specific execution-context projection
that omits `context.mastra` or replaces it with an explicit allowlist facade
that cannot reach raw storage, agent/workflow registries, provider/channel
clients, or other session-bypassing framework capabilities.

Legacy `emitEvent: event => this.emit(event)`, the legacy `HarnessEvent` union,
built-in tool raw event emission paths, and current `writer.custom()` /
`data-*` chunks are compatibility inputs only. They do not satisfy the v1
`emitCustomEvent(input)` contract unless wrapped by `HarnessCustomEventInput`
validation, trusted identity and attribution stamping, and projection through
the v1 event adapter owned by §10 / HC-308 / HC-309.

Current Mastra tool suspension plumbing is also compatibility material, not the
v1 authoring boundary. Existing `context.agent.suspend(...)` /
`context.workflow.suspend(...)`, `context.agent.resumeData`,
`ToolAction.suspendSchema`, `ToolAction.resumeSchema`, and `SuspendOptions`
may be adapted behind `@mastra/core/harness/v1`, but the adapter must call the
§6.1 `suspendTool(...)` pending-registration path for non-approval tool
suspensions before invoking the lower-level workflow suspension. Adapter-derived
`resumeSchema` / `resumeLabel` metadata is preserved on
`PendingToolSuspension` when available, while `requireToolApproval` remains the
tool-approval path and must not be relabelled as `tool-suspension`. Current
agent-as-tool suspension metadata is mapped to the owning subagent session and
the §8/§10.6 attribution fields rather than exposing `isAgentSuspend` or child
run handles as public Harness v1 tool APIs.

Legacy thread selection (`currentThreadId`, `selectOrCreateThread()`,
`createThread()`, `switchThread()`, and `sendMessage(...)` auto-thread
creation), run/stream/thread-lock/channel paths may still be useful
implementation material behind the v1 layer, but they are not themselves the
`harness.session(...)`, `Session.message(...)`, or `Session.queue(...)`
boundary. A wrapper or replacement must provide the v1 §5.3 active
`SessionRecord` resolver, `createOrLoadActiveSession(...)` admission,
`AgentSignalBoundary`, per-signal terminal lookup, active `SessionRecord` lease
ownership, durable pending queue and receipts, and Harness-mode channel bridge
ingress/outbox semantics before those internals can back v1 session admission.
The legacy `currentThreadId` pointer and optional `threadLock` callbacks are
compatibility state only; they cannot substitute for the resolver matrix that
distinguishes active, closing, closed, corrupt, and tenant-hidden outcomes.

Legacy `currentThreadId` / `currentRunId`, the follow-up queue, process-local
pending approval/suspension/question/plan resolvers, thread-level
`threadLock.acquire` / `release`, `createThread`, `switchThread`, display
scheduler disposal, heartbeat shutdown, workspace destruction, and the
monolithic `destroy()` method are also compatibility inputs only. They are not
the v1 session-residency/eviction manager. Before legacy internals can back the
v1 subpath, the wrapper or replacement must provide the §5.4/§5.8 live
`Session` map keyed by `sessionId`, least-recently-active and idle eviction,
dirty-state flush over `SessionRecord`, pending-interrupt pins including the
parent/root subtree rule for subagents, `sessions.maxLive` saturation with
`HarnessLiveSessionLimitError`, non-terminal `session_evicted` only after cache
drop and lease release, and transparent `harness.session(...)` rehydration from
storage.

Current `workspace?: DynamicArgument<Workspace> | WorkspaceConfig`, the single
cached `workspaceFn` result, `getWorkspace()` / `resolveWorkspace()` semantics,
and `destroyWorkspace()` are compatibility inputs only. A v1 wrapper or
replacement must parse and normalize `HarnessWorkspaceConfig` separately from
core `WorkspaceConfig` constructor objects; maintain the shared, resource-keyed,
and session-keyed resolver state required by §2.7; single-flight lazy
materialization for the owning key; persist per-session provider recovery state
through `SessionRecord.workspace` via the §9 `onStateChange` commit barrier;
and enforce factory-shorthand `durability: 'ephemeral'` recovery before any
provider-id matching. A legacy core `WorkspaceConfig` object is not a valid v1
`kind` config unless an adapter explicitly converts it into the shared
workspace sugar or rejects it before it can be misrouted through the core
`Workspace` constructor. `destroyResourceWorkspace({ resourceId })` must use
the persisted-active-session check and teardown fence described in §4.1 so
concurrent session creation cannot race resource-workspace destruction.

Current legacy Harness events, core PubSub events, durable-agent stream events,
and `/agents/:agentId/observe` output are compatibility inputs only for Harness
v1. They do not constitute the v1 public `HarnessEvent` surface or session SSE
route. A v1 wrapper or replacement may use selected source events only behind a
Harness v1 event projector that maps supported payloads into the closed §10.2
union; leaves unsupported legacy-only event types legacy/internal unless their
canonical §10 owner is intentionally revised; stamps `HarnessEventBase` fields
from the owning session or harness epoch; preserves the same session event `id`
across `session.subscribe(...)`, session SSE, and harness fan-out copies; and
excludes legacy display events such as `display_state_changed` from public v1
`HarnessEvent` subscriber and SSE surfaces. Current UUIDs, `createdAt` dates,
topic indexes, or observe-route offsets are not v1 event IDs or replay cursors.
Session-scoped projected events feed the §10.5 in-memory session SSE buffer and
its `Last-Event-ID` replay rules; harness-scoped projected events remain
live-only through the local `harness.subscribe(...)` control-plane stream.

Legacy abort-controller plumbing, built-in `ask_user` / `submit_plan` /
`suspendTool` cancellation paths, subagent abort handling, generic
`AbortError` exceptions, and user-abort strings are compatibility inputs only.
The v1 wrapper or replacement must create the §4.5 `HarnessAbortedError` at the
selected v1 abort source for the tool turn and abort the §6.1 tool-visible
controller with that error as `AbortController.abort(reason)`. The observable
v1 invariant is `HarnessRequestContext.abortSignal.reason`, not the shape of
any legacy controller or string retained behind the legacy subpath.

Current `WorkflowScheduler`, schedule trigger history, and closure-backed
`BackgroundTaskManager.taskContexts` are also implementation inputs only. They
do not provide the §5.7 Harness wakeup recovery boundary by themselves. They
may feed a v1 wakeup projector or worker that creates or loads
`HarnessWakeupItem` rows and queues with the persisted `admissionId`, but
already persisted legacy schedules and task rows are not automatically upgraded
into v1 wakeup rows without an explicit migration or projector path (§5.7,
§14.6).
