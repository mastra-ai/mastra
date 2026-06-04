# Streaming tool arguments

## Origin PR / commit

- PR: [#13328](https://github.com/mastra-ai/mastra/pull/13328) — streamed tool arguments incrementally across tool renderers.
- Later changes: [#13335](https://github.com/mastra-ai/mastra/pull/13335) — preserved assistant message text before task/todo tool calls by splitting the streaming assistant component.

## User-visible behavior

- What the user sees: tool boxes can appear before the final tool call is available, then fill in argument previews as the model streams JSON.
- Special cases: `ask_user`, `submit_plan`, and task mutation tools update dedicated inline/pinned components from partial args.
- Must preserve: no duplicate tool boxes, final args replace partial args, pre-tool assistant text stays visible, history reload renders stable final args only.

## Entry points / commands

- Automatic: any model/tool stream that emits tool input start/delta/end chunks.
- Applies to normal tool calls, task tools, inline questions, and plan approval.

## TUI states

- Streaming input: component is created early with empty/partial args.
- Running: final `tool_start` updates existing component with final args.
- Complete/error: `tool_end` updates result and removes pending state.

## Headless / non-TUI behavior

- Core harness emits `tool_input_start`, `tool_input_delta`, and `tool_input_end` events.
- Headless consumers can observe those events, but this page focuses on TUI rendering.

## Streaming / loading / interrupted states

- Streaming: harness accumulates `argsTextDelta` in display-state buffers; TUI parses partial JSON and updates components.
- Interrupted: display state marks streaming-input tools as errored on agent end; TUI removes pending state on normal `tool_end`.

## Streaming vs loaded-from-history behavior

- Active streaming: partial args render live from `toolInputBuffers`.
- Loaded from history: `renderExistingMessages()` reconstructs tool components from stored final `tool_call.args` and matching `tool_result`; partial deltas are not replayed.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Raw streamed arg text | Harness display state `toolInputBuffers` | TUI tool handlers |
| Parsed partial args | TUI `handleToolInputDelta()` | Tool/ask/plan/task components |
| Final args | `tool_start` / stored `tool_call.args` | TUI live and history renderers |
| Pending tool components | TUI state `pendingTools` | Tool handlers/renderers |
| Assistant message split | TUI `streamingComponent` | Preserves text before and after tool calls |

## Key files

- `packages/core/src/harness/harness.ts` — emits tool input events and owns display-state buffers.
- `packages/core/src/harness/display-state.test.ts` — core buffer/status coverage.
- `mastracode/src/tui/event-dispatch.ts` — routes input events to handlers.
- `mastracode/src/tui/handlers/tool.ts` — creates early components and parses partial JSON.
- `mastracode/src/tui/components/tool-execution-enhanced.ts` — renders and updates argument previews.
- `mastracode/src/tui/render-messages.ts` — reload/history rendering from final tool calls.
- `mastracode/src/tui/components/task-progress.ts` — pinned task progress projection for task mutation tools.

## Dependencies / related features

- [Coding tools and approval permissions](./coding-tools-permissions.md) — tool execution surface.
- [Interactive TUI chat](../tui/interactive-chat.md) — streaming chat renderer.
- [Persistent conversations / switching](../threads/persistent-conversations.md) — history reconstruction path.

## Existing tests

- `packages/core/src/harness/display-state.test.ts` covers `tool_input_start/delta/end` buffers and streaming-input status.
- `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts` covers preview updates from partial args.
- `mastracode/src/tui/components/__tests__/ask-question-inline-long-labels.test.ts` covers streaming inline question args.
- `mastracode/src/tui/components/__tests__/task-progress.test.ts` covers pinned task progress rendering.

## Missing tests

- TUI handler test for `handleToolInputDelta()` parsing partial JSON into `pendingTools`.
- End-to-end TUI test covering live partial args then final `tool_start` replacement.
- Regression test for pre-tool assistant text surviving task mutation tool input streaming.
- History reload test proving partial args are not replayed and final args render correctly.

## Known risks / regressions

- Partial JSON parsing can silently skip malformed chunks until enough text arrives.
- Live streaming and history reload are intentionally different projections; regressions can hide if only one path is tested.
- Task tools have special pinned-state behavior and can diverge from generic tool boxes.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
