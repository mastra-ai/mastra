### 6.2 Field semantics

**Identity.**
- `sessionId`, `threadId`, `resourceId` are stable for the lifetime of a tool invocation. They identify *this* call's session, not the harness's "active" session (there isn't one — see §2.1).
- `harnessId` is the harness instance ID. Useful for log correlation across processes.

**State.**
- `getState()` returns the live state object — it reflects writes from earlier in the same turn.
- `setState({ ... })` shallow-merges the patch and resolves once the change is persisted to storage (durable transition, see §5.7).
- `setState(prev => next)` is the atomic form. Use it for read-modify-write — counters, array pushes, anything where the next value depends on the current one. The updater runs synchronously; the resolved promise means the new value is persisted.
- Tools sharing `state` across parallel tool calls (under `experimental_parallelToolCalls`) should prefer the functional form. Within a single tool invocation reads and writes are coherent regardless.

**Abort.**
- `abortSignal` is the turn's signal. It fires when the agent layer cancels the run (`agent.abort(...)`, max-steps), when the parent subagent run aborts, when the session is being closed, or when the harness process is tearing down. Cancellation is not a session concern in v1 — the harness does not own a public `abort` surface (see §3).
- Long-running tool work should subscribe to `abortSignal` and cancel cleanly. The harness will wait for `execute` to settle, but a tool that ignores the signal will block the run from terminating for as long as it takes.
- `abortSignal.reason` is a `HarnessAbortedError` whose `reason` field is one of the four `HarnessAbortReason` values (§4.5). The distinction matters when tools maintain external state (sandbox processes, locks, partial writes):

  | `reason`           | What tools should typically do |
  | ------------------ | ------------------------------ |
  | `agent_aborted`    | Run normal rollback/cleanup. The user wants this work stopped. |
  | `parent_aborted`   | Skip side-effect rollback by default — the parent's own cleanup will dominate. (Subagents only.) |
  | `session_closed`   | Treat as terminal. No new turn will land here. Release any resources keyed by `sessionId`. |
  | `process_restart`  | Best-effort cleanup. The session record stays intact; queued items are *not* failed by this reason — they replay per §5.7 on the next hydration. |

  Tools that don't care about the source can ignore `reason` and treat the signal as a flat "stop now."

**Events.**
- `emitEvent(event)` forwards any event to subscribers of this session. Custom event types pass through unchanged — the harness does not inspect or schema-validate them.
- Tools **must not** synthesize harness-owned event types: `agent_start`, `agent_end`, `text_delta`, `tool_start`, `tool_end`, `subagent_*`, `state_changed`, `mode_changed`, `model_changed`, `session_*`, `goal_*`. The harness owns these and will overwrite or duplicate them. Use a custom type prefix (e.g. `myorg.tool.progress`) for tool-level signals.
- `registerQuestion` / `registerPlanApproval` are how `ask_user` and `submit_plan` (and any custom suspending tools you write) hand control back to the user. The harness pairs the registration with a Mastra workflow suspension — see §5.7 for the resume story.

**Subagent linkage.**
- `subagentDepth` is `0` for the parent session, `1` for a direct subagent, `2` for a subagent of a subagent, capped at `subagents.maxDepth` (see §8).
- `source` is `'parent'` or `'subagent'` — derivable from `subagentDepth > 0` but exposed as a first-class field because most tool gating reads as `if (source === 'subagent') { ... }`.
- `parentSessionId` is the subagent's parent — same value the SessionRecord stores. Walking the chain rebuilds the subagent tree.
- `subagentToolCallId` is the parent's tool-call ID that spawned this subagent. Useful for attributing events back to a parent UI element.

**Workspace.**
- When configured (`HarnessConfig.workspace`), the resolved `Workspace` is plumbed through. Subagents inherit the parent's workspace by default; the subagent tool config can opt into a fresh workspace under `kind: 'per-session'` (see §2.7, §8).
- Tools that don't need filesystem or sandbox access should not look at this field. Tools that do should null-check and either fail informatively or degrade.
