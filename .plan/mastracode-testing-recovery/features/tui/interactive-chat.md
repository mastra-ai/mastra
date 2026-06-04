# Interactive TUI chat

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — initial TUI chat, streaming render, keyboard input, tool render, harness event dispatch.
- Later changes: Unknown — continue PR queue verification.

## User-visible behavior

- What the user can do: run `mastracode`, type prompts, see streamed assistant/tool output.
- Success looks like: input, status/footer, messages, tools, and interrupts stay coherent during a run.
- Must preserve: active streaming UI and loaded history should tell the same conversation story.

## Entry points / commands

- Commands / shortcuts / flags: `mastracode`, Enter, Ctrl+C/Escape, Ctrl+F, Ctrl+T, Ctrl+E.
- Automatic triggers: startup render, harness event subscription, existing-message render.

## TUI states

- Idle: editor accepts prompt; footer/status shows current thread/mode/model.
- Active / modal / error: streaming component, pending tools, approval/question overlays, abort/error cleanup.

## Headless / non-TUI behavior

- Supported: `--prompt` uses `headless.ts` and prints text/json/stream-json instead of TUI components.
- Not supported / unknown: visual parity with TUI components is not meaningful; history parity still matters.

## Streaming / loading / interrupted states

- Streaming / loading: live `message_*` and `tool_*` events update TUI projections.
- Abort / retry / resume: Ctrl+C/Escape calls `harness.abort()`; terminal cleanup comes from `agent_end`.

## Streaming vs loaded-from-history behavior

- While actively streaming: state lives in TUI projection maps like pending tools and streaming components.
- After reload / history reconstruction: `renderExistingMessages()` rebuilds from persisted messages; live-only state should not resurrect as active work.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Chat history | Harness / memory storage | TUI renderer, headless output |
| Active run | Harness runtime | TUI keyboard/status handlers |
| Streaming components | TUI transient projection | Chat container |
| Abort state | Harness terminal event after TUI request | TUI cleanup |

## Key files

- `mastracode/src/tui/mastra-tui.ts` — startup, subscription, event handling.
- `mastracode/src/tui/setup.ts` — keyboard shortcuts and submit behavior.
- `mastracode/src/tui/event-dispatch.ts` — event-to-handler routing.
- `mastracode/src/tui/render-messages.ts` — history reconstruction.
- `mastracode/src/headless.ts` — non-TUI run path.

## Dependencies / related features

- [Persistent conversations](../threads/persistent-conversations.md) — chat is thread-scoped.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — selected mode/model drives runs.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — tools render inside chat.

## Existing tests

- `mastracode/src/tui/__tests__/mastra-tui-queueing.test.ts` — active-run queue/signal behavior.
- `mastracode/src/tui/__tests__/setup-keyboard-shortcuts.test.ts` — shortcut behavior.
- `mastracode/src/tui/event-dispatch.test.ts`, `render-messages.test.ts` — event/history rendering.
- `mastracode/src/headless.test.ts` — non-TUI path.

## Missing tests

- Live stream → quit/reload → reconstructed UI parity.
- Abort while tool output streams, including persisted history shape.
- Enter-as-signal vs Ctrl+F queued follow-up after reload.

## Known risks / regressions

- Harness v1 risk: live event projection and persisted history projection can drift.
- Slack task-list report is adjacent: rendered state and prompt/tool state diverged.
- Headless abort timeout existed pre-Harness v1; treat as baseline noise until reverified.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
