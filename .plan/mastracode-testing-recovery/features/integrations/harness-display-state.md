# Harness display state

## Origin PR / commit

- PR: [#13427](https://github.com/mastra-ai/mastra/pull/13427) — added `HarnessDisplayState` as a UI-agnostic display-state projection for Harness consumers.
- Later changes: none mapped yet.

## User-visible behavior

- What the user can do: TUI and future UI consumers can render from a canonical display snapshot instead of each interpreting raw Harness events differently.
- Success looks like: status line, active tools, OM progress, queued follow-ups, approvals, tasks, subagents, and modified-file indicators stay synchronized across event bursts.
- Must preserve: raw event subscriptions still work, while display-state subscribers receive cloned/coalesced snapshots.

## Entry points / commands

- Commands / shortcuts / flags: no direct slash command; affects status-line refresh, task/tool display, approvals, OM progress, and external Harness UI consumers.
- Automatic triggers: every Harness event updates display state and emits `display_state_changed`; `subscribeDisplayState()` coalesces high-frequency updates.

## TUI states

- Idle: `getDisplayState()` supplies task, token, OM, and modified-file state to renderers.
- Active / modal / error: pending approval/question/plan/suspension and active tool/subagent state live in the Harness display projection.

## Headless / non-TUI behavior

- Supported: core Harness API exposes `getDisplayState()` and `subscribeDisplayState()` independently of the TUI.
- Not supported / unknown: headless CLI output was not verified to render from display state.

## Streaming / loading / interrupted states

- Streaming / loading: high-frequency `message_update`, `tool_input_delta`, and shell output mutate display state; non-critical snapshots are coalesced.
- Abort / retry / resume: `agent_end` marks running tools as errored, clears pending prompt state, and immediately flushes display state.

## Streaming vs loaded-from-history behavior

- While actively streaming: display state is the live runtime projection maintained by `applyDisplayStateUpdate()`.
- After reload / history reconstruction: `renderExistingMessages()` still reconstructs persisted chat history; display state tracks current live UI affordances, not a persisted transcript.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Canonical display projection | `Harness.displayState` | TUI status line, external Harness UIs |
| Event-to-display state machine | `applyDisplayStateUpdate()` | `display_state_changed`, `getDisplayState()` |
| Coalesced subscriptions | `DisplayStateScheduler` | UI consumers wanting latest snapshots |
| Critical event policy | `CRITICAL_DISPLAY_STATE_EVENT_TYPES` | subscription flush timing |

## Key files

- `packages/core/src/harness/types.ts` — `HarnessDisplayState`, `defaultDisplayState()`, display-state event/listener types.
- `packages/core/src/harness/harness.ts` — event emission, `applyDisplayStateUpdate()`, `getDisplayState()`, `subscribeDisplayState()`.
- `packages/core/src/harness/display-state-scheduler.ts` — cloned/coalesced display-state snapshots and critical-event flush policy.
- `packages/core/src/harness/display-state.test.ts` — comprehensive state-machine and scheduler coverage.
- `mastracode/src/tui/event-dispatch.ts` — `display_state_changed` routes status-line refresh centrally.
- `mastracode/src/tui/status-line.ts` — reads OM/running status from `harness.getDisplayState()`.
- `mastracode/src/tui/render-messages.ts` — restores task display state during history reconstruction.

## Dependencies / related features

- [Core Harness API and reference docs](./harness-api.md) — display state extends the public Harness UI-consumer surface.
- [Interactive TUI chat](../tui/interactive-chat.md) — live event projection depends on this state machine.
- [Streaming tool arguments](../tools/streaming-tool-arguments.md) — active tool/input buffers are in display state.
- [Task tracking tools and TUI progress](../tools/task-tracking.md) — current/previous task snapshots live in display state.
- [Observational memory](../memory/observational-memory.md) — OM status fields moved into display state for rendering.

## Existing tests

- `packages/core/src/harness/display-state.test.ts` — defaults, lifecycle, tool/tool-input, prompts/plans, subagents, OM, tasks, modified files, `display_state_changed`, coalesced subscriptions, and a non-TUI subscriber rendering contract.
- `mastracode/src/tui/event-dispatch.test.ts` — task update routing plus display-state status-line routing: `display_state_changed` refreshes the status line while raw streamed `tool_input_delta` events do not bypass display-state coalescing.
- `mastracode/src/tui/render-messages.test.ts` — task display-state restoration during history rendering.
- `mastracode/scripts/mc-e2e/scenarios/streaming-tool-args.ts` — drives a real AIMock-streamed `view` tool call through the PTY TUI and verifies live partial argument projection before final tool result replacement.
- `mastracode/scripts/mc-e2e/scenarios/task-progress-events.ts` — drives a real AIMock `task_write` tool call through the PTY TUI and verifies pinned task progress plus follow-up tool-result request handling.
- `mastracode/scripts/mc-e2e/scenarios/tool-history-reload.ts` — reloads persisted completed tool/task history through `/threads` and proves completed transcript state does not resurrect as active display-state work.

## Missing tests

- None known for the mapped Harness display-state recovery scope. Future UI consumers can add product-specific display-state subscriber tests as they adopt `subscribeDisplayState()`.

## Known risks / regressions

- Display state is another projection; drift is possible if future Harness event types do not update `applyDisplayStateUpdate()`.
- `getDisplayState()` returns the live reference, while `subscribeDisplayState()` sends cloned snapshots; callers must not assume identical mutation semantics.
- TUI still interprets raw events for many components, so the migration is partial rather than a pure display-state renderer.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
