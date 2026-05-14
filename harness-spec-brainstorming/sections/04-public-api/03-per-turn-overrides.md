### 4.3 Per-turn overrides

`message` and `useSkill` accept the full per-turn override set. `queue`
accepts only the serializable subset (`model`, `mode`, `yolo`); `addTools` is
excluded because queued work must survive restart. The keys are `model` and
`mode` — matching `Session#switchModel({ model })` and
`Session#switchMode({ mode })` exactly. Whether you're setting durable session
state or a one-turn override, the option name is the same.

```ts
interface HarnessOverrides {
  model?: string;          // Use a different model for this turn only
  mode?: string;           // Use a different mode for this turn only
  addTools?: ToolsetInput; // Add extra tools for this turn (merged on top, separate namespace)
  yolo?: boolean;          // Bypass approval prompts for this run only
}

interface PersistedRunOverrides {
  model?: string;
  mode?: string;
  yolo?: boolean;
}
```

The effective mode for a run is selected in this order: explicit per-call
`opts.mode`, then `HarnessSkill.defaultMode` for `useSkill(...)`, then the
session's persisted `SessionRecord.modeId`. The selected mode must exist in the
configured mode catalog and its `HarnessMode.agentId` selects the agent for that
run. Per-turn mode overrides and skill default modes do not mutate the session
default; they only affect the committed run surface.

The effective model for a run is selected from explicit per-call `opts.model`,
then the session's persisted `SessionRecord.modelId`; configured
`HarnessConfig.defaultModelId` and `HarnessMode.defaultModelId` only seed a
session that lacks a selected model. At run start, the harness resolves the
effective opaque model ID through `HarnessConfig.resolveModel(...)` and passes
the resulting `LanguageModel` to the selected Agent call for `message(...)`,
drained `queue(...)`, `useSkill(...)`, and typed output. Per-turn model
overrides do not mutate the session default; they affect only that committed
run surface.

Overrides do not persist to thread metadata, do not emit `state_changed` events,
and do not affect subsequent turns. The serializable subset (`model`, `mode`,
`yolo`) surfaces in the `agent_start` event under an optional `overrides` field
for debuggability. `addTools` is a live tool-surface binding: its closures are
never written to `SessionRecord.currentRun.toolIds`, queued entries, or wire/SSE
payloads. When a `message(...)` or `useSkill(...)` entry point starts a run with
`addTools`, the harness sets `currentRun.nonRehydratableToolSurface = true`
(§5.1) as part of the synchronous run-start transition — that durable boolean is
how recovery later detects that the run's tool surface cannot be reconstructed.

`yolo` is an approval-bypass policy decision, not a tenancy check. It only
converts tool-approval `ask` outcomes to allow for the run; explicit per-tool or
category `deny` rules remain hard stops, and route/resource/principal
authorization still happens before admission. It also does not bypass restricted
sandbox command policy (§7). Local in-process callers may apply their own
product policy before setting it. Remote wire callers can send `yolo: true` only
when the server has already authorized the authenticated principal for the
approval-bypass capability defined in §13.2; otherwise admission rejects before
the run, queue item, or skill invocation is recorded. `yolo: false` is
normalized to absence for override-conflict checks, persistence, and admission
hashing; only `yolo: true` requests approval bypass.
Queued items replay the persisted `yolo` bit that was authorized at admission,
but a later effective `deny` still blocks the tool call when that queued turn
drains.

After a restart, a non-terminal `currentRun` can be reattached only with the
persisted serializable surface. When `currentRun.nonRehydratableToolSurface` is
`true`, the original run's `addTools` closures are gone and the run fails closed
on hydration with row `error.code = 'tool_surface_unrehydratable'` (bare
`HarnessRowErrorCode` per §4.5d; wire surfaces project through §13.3f.1 to
`harness.session_corrupt` with
`error.details.reason = 'tool_surface_unrehydratable'`; see §5.7 and §6.2).
Independent of that per-run fail-closed branch, Harness treats *any* recovered
active run as unable to accept new `message({ addTools })` signals until the
thread is idle: it rejects with `HarnessOverrideConflictError` instead of
assuming the lost live tool surface was empty. `queue(...)` still rejects
`addTools` at admission.

For `queue` items, overrides are stored on the queued entry in
`SessionRecord.pendingQueue` and applied when that item's turn runs.
**`addTools` is not allowed on `queue(...)`** — `QueueOptions` omits the field
at the type level, and a runtime admission check rejects callers that pass it
dynamically (wire-protocol body, cast, etc.) with `HarnessValidationError`.
Queued items are durable and tool implementations are closures that don't
round-trip through storage; accepting `addTools` here would mean a post-crash
replay silently runs with a different tool surface than the caller requested.
Callers who need a one-shot custom tool surface should use `message(...)` on an
idle thread or `useSkill(...)`, where the override is bound to a run that exists
for its full lifetime in memory.

**Overrides bind to a turn boundary, not to user input.** A per-turn override is
a property of the *agent run* the entry point starts. The run surface — which
mode-selected agent is running, which model is talking, which selected-agent
prompt and tool surface are exposed, and which per-turn tools were added — is
committed when the run starts and is invariant for that run's lifetime. Signals
only let user content interleave into a live run; they do *not* let the surface
mutate underneath the model. This matters because `message()` has two delivery
modes:

| Delivery mode | Override behavior |
| --- | --- |
| `message()` lands while the thread is **idle** → starts a new run | Overrides apply to that run, exactly as they do for `queue` and `useSkill`; a `mode` override selects that mode's bound agent. |
| `message()` drains as user input into an **already-active** run | The run's surface and run-scoped approval-bypass policy were already committed; the signal cannot retroactively change `agentId`, `model`, `mode`, `addTools`, or `yolo`. |
| `queue()` item, drained later as a fresh standalone turn | Overrides apply to that item's run when it eventually drains (see above). |
| `useSkill(...)` | New non-duplicate admission requires an idle thread; when admitted, it starts a fresh run and overrides apply normally. Exact untyped duplicate `admissionId` retries return retained evidence before the busy check. |

For `message()` in the second row, the harness's behavior depends on whether
the call carries overrides:

- **No overrides** — accepted normally. The signal is delivered, the user
content interleaves into the live run, the run keeps its committed surface. This
is the common case.
- **Any of `model`, `mode`, `addTools`, or `yolo: true` set** — admission-time
reject with `HarnessOverrideConflictError`. The run cannot honour the override
and silently dropping it would be a footgun; for `yolo`, accepting the signal
would introduce a second approval-bypass scope after `currentRun.yolo` and
`agent_start.overrides` were already committed. The caller decides what to do:
drop the override and resend; abort the live run via the agent-layer surface
(see §3 — there is no `session.abort()` in v1) and resend (the next signal will
start a fresh run with the override applied); or — for `model`, `mode`, or
`yolo` — call `session.queue(...)` so the override applies to the queued
standalone turn. `queue(...)` rejects `addTools` of its own accord (see below),
so callers who specifically need a one-shot tool surface have to wait for the
live run to end and resend via `message(...)` on idle, or use `useSkill(...)`.

The check looks at the run that this *specific signal* would deliver into, not
at the session generally — so once the live run finishes and the next
`message()` lands on an idle thread, overrides apply normally again. The run's
committed serializable surface is reported on `agent_start.overrides` so
subscribers can see what the active run is using.

**Linearisation.** "Active run" is determined at admission, under the active
session owner's ordering for that `(harnessName, resourceId, threadId)` (§5.8
write lease). A run that finishes between the user's call and harness admission
would have left the thread idle by the time admission happens, and overrides
apply to the new run started by this signal. There is no window in which the
harness admits a signal believing the thread is idle and then drops it into a
run that started concurrently: all callers for the same thread inside one
Harness namespace resolve to one active session owner, and that owner orders the
agent signal queue with the harness admission check.
