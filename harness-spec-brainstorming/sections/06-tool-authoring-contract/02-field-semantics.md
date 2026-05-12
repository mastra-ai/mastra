### 6.2 Field semantics

**Identity.**
- `harnessName` is the registered Mastra Harness namespace for this tool
invocation. It matches the owning `SessionRecord.harnessName`, the bound
`HarnessStorage` view, and every independently loadable Harness-domain record
involved in the turn (§5.1/§5.2). For subagent turns, this is the same Harness
namespace as the parent/root session.
- `harnessInstanceId` is the process-scoped identifier for the live Harness
instance that built this context. It is useful for log correlation and
diagnostics only. It is the same value the instance uses as `ownerId` when it
holds session leases (§5.8), but exposing it to tools does not grant lease
authority: tools must not persist it as durable identity, send it to server
routes, use it as a storage key, or use it to decide resume/recovery ownership.
- `sessionId`, `threadId`, `resourceId` are stable for the lifetime of a tool
invocation. They identify the owning `SessionRecord` for this call inside the
Harness namespace that created the tool context. For a root turn, that record is
the active session owner for `(harnessName, resourceId, threadId)` (§2.2); for a
subagent turn, it is the child session record linked by `parentSessionId`
(§2.4/§5.6). They are Harness-owned identity fields, not values a tool or caller
can override.

**State.**
- `getState()` returns a current detached `ReadonlyState<TState>` snapshot of
the latest committed session state. It reflects earlier awaited `setState` calls
in the same turn (see §5.7 for durability), but the returned value is immutable:
it must not share mutable references with canonical session state, and tools
must not mutate it directly. Tools that need the current value to compute a next
value should use the functional `setState(prev => next)` form, which receives
the same read-only snapshot guarantee.
- `state` is the point-in-time snapshot captured when this
`HarnessRequestContext` was built. It does not update after intra-turn
`setState` calls. Prefer `getState()` when current session state matters;
reading `state` after calling `setState(...)` in the same turn returns stale
data.
- `setState({ ... })` applies the §5.1 object-form state merge algorithm and
resolves once the change is persisted to storage (durable transition, see §5.7).
Omitted keys are unchanged, explicit `null` is stored as a value, arrays and
nested objects replace as whole top-level values, and object-form writes cannot
delete keys. `undefined` or any other non-JSON/lossy value rejects before
merge/commit rather than becoming an implicit delete. The harness detaches
committed state from caller-owned patch objects before storing or emitting it,
so later mutation of the original patch object cannot mutate canonical session
state.
- `setState(prev => next)` is the atomic read-modify-write form. Use it for
counters, array pushes, key deletion, or anything where the next value depends
on the current one. The updater receives a `ReadonlyState<TState>` snapshot and
must not mutate `prev`; mutating `prev` and returning it is outside the
contract. The updater runs synchronously; the returned value is validated as a
complete replacement object and the resolved promise means that new state is
persisted. A functional updater can remove a key only by returning a complete
next state object that omits that key. The harness detaches the committed state
from the updater return value before storing or emitting it.
- Tools sharing `state` across parallel tool calls (under
`experimental_parallelToolCalls`) should prefer the functional form. Within a
single tool invocation, `await setState(...)` followed by `getState()` observes
that committed write. This is not a transaction across parallel tools; if the
next value depends on current state, use `setState(prev => next)`.

**Activity timeline.**
- `getActivityTimeline(opts)` returns the same bounded, redacted
`SessionActivityTimeline` projection as the owning Session accessor (§4.2d) and
the `/activity` route (§13.2). It is available on harness-created,
owning-Session tool contexts, including reconstructable background-task
`kind: 'tool'` executors whose `BackgroundTaskReconstructableRow` supplies
`harnessName`, `resourceId`, `sessionId`, and `threadId` (§5.1b.2/§9.2).
Sessionless diagnostic background tasks do not receive a synthetic activity
timeline.
- The accessor is rebound from the owning `sessionId` / `threadId` /
`resourceId` when the context is constructed. Subagent, forked, or copied
contexts must rebuild or rebind the accessor for the owning child session and
must not inherit a parent-bound closure. For subagent contexts,
`includeDescendants: true` walks only descendants of the owning child session
that remain in the same `(harnessName, resourceId)` scope; it never includes
the parent chain, sibling sessions, or cross-resource rows.
- Reads use the same `ActivityTimelineOptions` validation, cursor scoping,
redaction, truncation, defaults, and `lists.activity` max-limit rules as the
Session and route layers (§5.1b.4/§9.1/§13.2). Tools should pass `limit` when
they need only recent grounding so they do not assemble larger projections than
needed. A cursor created for a different session, activity projection surface,
or `includeDescendants` value is invalid for this accessor and rejects before
scanning.
- Each call assembles a fresh read from durably committed authorities at
read-time; the request context does not cache timeline pages. A tool call part
may be visible while that tool is still executing if the containing message
part has committed, but that tool's result is not visible until the result
authority commits. Parallel tools under `experimental_parallelToolCalls` may
therefore observe drift between their respective timeline reads.
`emitCustomEvent(...)` outputs are live events only and are not
`ActivityTimelineEntryKind` values.
- Closing and closed sessions follow the same behavior as the Session accessor
and `/activity` route: closed sessions return reconstructable history while
source authorities are retained. If the owning session has been deleted or made
tenant-hidden before the read, the accessor follows the same tenant-safe
deleted/not-found behavior as the Session and route layers.

**Abort.**
- `abortSignal` is the turn's signal. It fires when the agent layer cancels the
run (`agent.abort(...)`, max-steps), when the parent subagent run aborts, when
the session is being closed, or when the harness process is tearing down.
Cancellation is not a session concern in v1 — the harness does not own a public
`abort` surface (see §3).
- Long-running tool work should subscribe to `abortSignal` and cancel cleanly.
During ordinary agent aborts the harness waits for `execute` to settle, but
bounded session close waits only until the stored `closeDeadlineAt` (§5.5);
after that deadline the session terminalizes and any later Harness writes from
ignored tool work fail as closing, closed, stale, or lease-lost.
- `abortSignal.reason` is a `HarnessAbortedError` whose `reason` field is one of
the four `HarnessAbortReason` values (§4.5). The distinction matters when tools
maintain external state (sandbox processes, locks, partial writes):

  | `reason`           | What tools should typically do |
  | ------------------ | ------------------------------ |
  | `agent_aborted`    | Run normal rollback/cleanup. The user wants this work stopped. |
  | `parent_aborted`   | Skip side-effect rollback by default — the parent's own cleanup will dominate. (Subagents only.) |
  | `session_closed`   | Treat as terminal. No new turn will land here. Release any resources keyed by `sessionId`. |
  | `process_restart`  | Best-effort cleanup. The session record stays intact; queued items are *not* failed by this reason — they replay per §5.7 on the next hydration. |

  Tools that don't care about the source can ignore `reason` and treat the signal as a flat "stop now."
- The tool-visible controller is one-shot: once the harness aborts it, the
selected `HarnessAbortedError` is not replaced by a later source. When multiple
abort sources are observed before the tool-visible controller is aborted, the
harness selects the most specific v1 reason before calling
`AbortController.abort(reason)`: `session_closed` for a session already in the
close lifecycle, `parent_aborted` for subagent parent-run propagation while the
child session is not closing, `process_restart` for live process shutdown or
live-session eviction when no close or parent-abort reason applies, and
`agent_aborted` for ordinary agent-layer cancellation. `process_restart` is
live-only; durable recovery after a real restart follows §5.7 and must not
surface as a terminal tool-visible `HarnessAbortedError`.
- Harness-authored built-ins that wait inside a tool turn (`ask_user`,
`submit_plan`, `suspendTool`, and the built-in `subagent` execution path)
preserve the same `abortSignal.reason` when interrupted. They may produce
UI-safe status text or tool results where their owning section requires it, but
they must not replace the Harness-owned abort reason with a generic
`DOMException`, generic `AbortError`, or user-abort string on Harness-visible
error or settlement surfaces.

**Events.**
- `emitCustomEvent(input)` forwards a custom event to session subscribers. The
harness validates `type` at call time — reserved internal prefixes and exact
built-in names are rejected with `HarnessValidationError`. The harness fills
event and session identity fields (`id`, `sessionId`, `timestamp`, `resourceId`,
`threadId`) before dispatching. Custom payloads go through `input.payload` and
must be JSON-serializable. The emitted subscriber event is
`HarnessEventBase & CustomEvent` (§10.2), with `payload` omitted when the input
omitted it and with §10.6 attribution when surfaced through a parent subagent
stream.
- Tools **must not** synthesize harness-owned event types. The `emitCustomEvent`
API accepts only `HarnessCustomEventInput`, and runtime validation rejects
built-in names and reserved internal prefixes. Use a dotted custom prefix (e.g.
`myorg.tool.progress`) for tool-level signals.

**Suspension.**
- `registerQuestion` / `registerPlanApproval` are how `ask_user` and
`submit_plan` hand control back to the user for the question and plan-approval
patterns respectively. They are tool-context-only `HarnessRequestContext`
methods, not public `Session`, `RemoteSession`, or wire APIs (§4.2/§13.5). The
harness derives `runId`, `toolCallId`, pending identity, owning session,
`source`, and workflow suspension target from the active tool context; callers
only supply the question or plan payload. They resolve only after the pending
item is committed under the session lease; validation, closed-session, lease, or
storage failures reject before any pending-item event is emitted. The harness
pairs the registration with a Mastra workflow suspension — see §5.7 for the
resume story.
- `suspendTool({ suspendData })` is the dedicated v1 API for mid-execution tool
suspension (the `PendingToolSuspension` path). It durably records the pending
suspension, validates that `suspendData` is JSON-serializable, preserves
adapter-derived resume metadata from the registered tool/current
`SuspendOptions` when available (§5.1), and rejects with an internal interrupt
to halt agent execution. Tool authors **must `await` or `return await` this call
and must not catch** the interrupt — the harness/workflow engine owns the
suspension boundary and the tool's execution will resume when the external
system calls `respondToToolSuspension`. The call to `suspendTool` returns
`Promise<never>`; code after `await suspendTool(...)` is unreachable. Current
`context.agent.suspend(...)` / `context.workflow.suspend(...)` surfaces are
compatibility inputs only: a v1 adapter may route them through the same
lease-gated pending-registration path, but they are not additional Harness v1
APIs. Current `requireToolApproval` suspension options stay on the tool-approval
gate path and must not be stored as `PendingToolSuspension`.
- Only one pending interaction per owning session/run is allowed. A second
`registerQuestion`, `registerPlanApproval`, or `suspendTool` call within the
same run rejects with `HarnessBusyError` before any durable write. The slot
check and write are one session-lease transition, shared with harness-authored
tool-approval gates. The error `reason` names the existing blocking pending kind
(`pending_approval`, `pending_suspension`, `pending_question`, or
`pending_plan`), not the attempted API. Parallel calls under
`experimental_parallelToolCalls` will see one win and the others rejected.
- Tools capable of suspension must be reconstructable after hydration. Any tool
dynamically added via the `addTools` per-turn override on `message(...)`
(signal-driven, `stream`, or `sync: true, output` forms) or `useSkill(...)` is
process-local — its closures cannot persist, and the run cannot be resumed after
restart. The harness records this at run start as
`HarnessRunOperationalState.nonRehydratableToolSurface = true` (§5.1) and uses
that durable flag during hydration (§5.7) to fail closed: any persisted pending
interaction for the run (`pendingApproval` / `pendingSuspension` /
`pendingQuestion` / `pendingPlan`) is dropped, the run is marked `interrupted`
with row `error.code = 'tool_surface_unrehydratable'` (bare
`HarnessRowErrorCode` per §4.5d) on `HarnessRunOperationalState.error.code`,
and an `error` `TurnEvent` is emitted whose payload projects through
§13.3f.1 to `error.code = 'harness.session_corrupt'` with
`error.details.reason = 'tool_surface_unrehydratable'`.

**Channel.**
- `channel` is present only when the turn was admitted through the channel
bridge or when durable/proactive work explicitly supplies channel context. It
identifies the normalized platform conversation, trigger, and actor that
produced the input; it does not override `harnessName`, `resourceId`,
`threadId`, or `sessionId`. When present, `channel.harnessName` must equal the
outer `harnessName`; a trusted integration context with a mismatched Harness
namespace is invalid and must fail before tool execution or be rebuilt from the
resolved binding.
- Tools may use `channel.capabilities` to tailor emitted progress or prompt
metadata, but the channel slot is descriptive metadata, not an authenticated
provider client, SDK thread, webhook request, or adapter handle. Tools must not
call platform APIs directly for user-visible delivery; §6.3 defines the
enforcement boundary for arbitrary in-process tool code versus Harness-owned
capability surfaces. Durable outbound goes through the Harness channel outbox
(§14.4), not through ad hoc tool side effects.

**Subagent linkage.**
- `subagentDepth` is `0` for the parent session, `1` for a direct subagent, `2`
for a subagent of a subagent, and always reflects the persisted
`parentSessionId` chain. New descendant creation is capped by
`sessions.maxSubagentDepth` (see §8).
- `source` is `'parent'` or `'subagent'` — derivable from `subagentDepth > 0`
but exposed as a first-class field because most tool gating reads as
`if (source === 'subagent') { ... }`.
- `parentSessionId` is the subagent's parent — same value the SessionRecord
stores. Walking the chain rebuilds the subagent tree.
- `subagentToolCallId` is the parent's tool-call ID that spawned this subagent.
Useful for attributing events back to a parent UI element.

**Workspace.**
- `hasWorkspace()`, `isWorkspaceReady()`, `getWorkspace()`, and
`resolveWorkspace()` mirror the owning `Session` workspace accessors from §4.2.
They do not expose the full `Session` object to tool code; they delegate to the
same session-owned workspace resolver for the active tool invocation.
- `getWorkspace()` and `workspace` are non-materializing reads. They return the
live `Workspace` only when it has already been materialized or eagerly
provisioned for this session, and otherwise return `undefined` for a
configured-but-not-yet-materialized lazy workspace. Context construction must
not materialize a workspace solely to fill the snapshot field.
- Tools that require filesystem / sandbox access call
`await resolveWorkspace()`. That call is the explicit materialization/resume
path for lazy workspace provisioning and surfaces the same workspace-lost,
provider-mismatch, and no-substitute semantics as §2.7/§4.2; those failures must
not degrade to a silent `undefined` workspace.
- Harness-authored lazy built-in workspace tool wrappers (§2.7) use this same
session-owned resolver at execution time. They are not a second workspace
authority, and tool authors do not need to call `resolveWorkspace()` merely to
satisfy those internal wrappers.
- Tools that don't need filesystem or sandbox access should not call
`resolveWorkspace()`, so sessions whose turns never need workspace access avoid
cloud sandbox cold starts. `hasWorkspace()` distinguishes "workspace configured"
from "not configured"; `isWorkspaceReady()` distinguishes an already-live
workspace from one that would require materialization/resume.
- Subagents inherit the parent's workspace resolver by default; the subagent
tool config can opt into a fresh workspace under `kind: 'per-session'` (see
§2.7, §8). In the inherited case the accessors resolve the inherited parent
workspace; in the fresh case they resolve the child session's own workspace.
