### 4.3 Per-turn overrides

Every entry point (`message`, `queue`, `useSkill`) accepts the same scoped overrides. The keys are `model` and `mode` — matching `Session#switchModel({ model })` and `Session#switchMode({ mode })` exactly. Whether you're setting durable session state or a one-turn override, the option name is the same.

```ts
interface HarnessOverrides {
  model?: string;          // Use a different model for this turn only
  mode?: string;           // Use a different mode for this turn only
  addTools?: ToolsetInput; // Add extra tools for this turn (merged on top, separate namespace)
  yolo?: boolean;          // Bypass approval prompts for this turn only
}
```

Overrides do not persist to thread metadata, do not emit `state_changed` events, and do not affect subsequent turns. They surface in the `agent_start` event under an optional `overrides` field for debuggability.

For `queue` items, overrides are stored on the queued entry in `SessionRecord.pendingQueue` and applied when that item's turn runs. **`addTools` is not allowed on `queue(...)`** — `QueueOptions` omits the field at the type level, and a runtime admission check rejects callers that pass it dynamically (wire-protocol body, cast, etc.) with `HarnessValidationError`. Queued items are durable and tool implementations are closures that don't round-trip through storage; accepting `addTools` here would mean a post-crash replay silently runs with a different tool surface than the caller requested. Callers who need a one-shot custom tool surface should use `message(...)` on an idle thread or `useSkill(...)`, where the override is bound to a run that exists for its full lifetime in memory.

**Overrides bind to a turn boundary, not to user input.** A per-turn override is a property of the *agent run* the entry point starts. The run surface — which model is talking, which mode shapes the system prompt, what tool surface is exposed — is committed when the run starts and is invariant for that run's lifetime. Signals only let user content interleave into a live run; they do *not* let the surface mutate underneath the model. This matters because `message()` has two delivery modes:

| Delivery mode | Override behaviour |
| --- | --- |
| `message()` lands while the thread is **idle** → starts a new run | Overrides apply to that run, exactly as they do for `queue` and `useSkill`. |
| `message()` drains as user input into an **already-active** run | The run's surface was already committed; the signal cannot retroactively change `model`, `mode`, or `addTools`. |
| `queue()` item, drained later as a fresh standalone turn | Overrides apply to that item's run when it eventually drains (see above). |
| `useSkill(...)` | Always starts a fresh run; overrides apply normally. |

For `message()` in the second row, the harness's behaviour depends on whether the call carries overrides:

- **No overrides** — accepted normally. The signal is delivered, the user content interleaves into the live run, the run keeps its committed surface. This is the common case.
- **`yolo` only** — accepted. `yolo` is an admission-time policy gate on approval prompts (the next prompt this signal causes the model to emit), not a property of the run surface, so it is honoured without disturbing the live run.
- **Any of `model`, `mode`, `addTools` set** — admission-time reject with `HarnessOverrideConflictError`. The run cannot honour the override and silently dropping it would be a footgun. The caller decides what to do: drop the override and resend; abort the live run via the agent-layer surface (see §3 — there is no `session.abort()` in v1) and resend (the next signal will start a fresh run with the override applied); or — for `model` / `mode` only — call `session.queue(...)` so the override applies to the queued standalone turn. `queue(...)` rejects `addTools` of its own accord (see below), so callers who specifically need a one-shot tool surface have to wait for the live run to end and resend via `message(...)` on idle, or use `useSkill(...)`.

The check looks at the run that this *specific signal* would deliver into, not at the session generally — so once the live run finishes and the next `message()` lands on an idle thread, overrides apply normally again. The run's committed surface is reported on `agent_start.overrides` so subscribers can see what the active run is using.

**Linearisation.** "Active run" is determined at admission, under the same per-session ordering that linearises signal delivery (§5.8 write lease). A run that finishes between the user's call and harness admission would have left the thread idle by the time admission happens, and overrides apply to the new run started by this signal. There is no window in which the harness admits a signal believing the thread is idle and then drops it into a run that started concurrently: the agent layer's signal queue and the harness's admission check are ordered by the same lease.
