# Streaming tool arguments

## Origin PR / commit

- PR: [#13328](https://github.com/mastra-ai/mastra/pull/13328) — streamed tool arguments incrementally across tool renderers.
- Later changes: [#13335](https://github.com/mastra-ai/mastra/pull/13335) — preserved assistant message text before task/todo tool calls by splitting the streaming assistant component; [#13344](https://github.com/mastra-ai/mastra/pull/13344) — renamed todo streaming paths to task tools and moved tool ownership into core Harness; [#13427](https://github.com/mastra-ai/mastra/pull/13427) — folded active tool and tool-input buffers into canonical `HarnessDisplayState`; [#14472](https://github.com/mastra-ai/mastra/pull/14472) — removed italic styling from rendered tool arguments while preserving argument color tinting; [#14535](https://github.com/mastra-ai/mastra/pull/14535) — makes tool-result object rendering JSON-safe for circular structures using shared safe serialization helpers; [#15566](https://github.com/mastra-ai/mastra/pull/15566) — bounds ANSI/error parsing used by streamed tool renderers to prevent pathological output from hanging the TUI.

## User-visible behavior

- What the user sees: tool boxes can appear before the final tool call is available, then fill in readable non-italic argument previews as the model streams JSON; completed object results render even when they contain circular references.
- Special cases: `ask_user`, `submit_plan`, and task mutation tools update dedicated inline/pinned components from partial args.
- Must preserve: no duplicate tool boxes, final args replace partial args, pre-tool assistant text stays visible, history reload renders stable final args/results only, circular results are marked instead of crashing, and argument/result styling remains legible without regex backtracking hazards in normal/quiet modes.

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
| Final args/results | `tool_start` / stored `tool_call.args`; core `ensureSerializable()` and TUI `safeStringify()` for object results | TUI live and history renderers |
| Argument styling/parsing | `CODE_HIGHLIGHT_THEME` / `QUIET_CODE_HIGHLIGHT_THEME` token colors without italic font style + bounded ANSI/error parsing helpers | Tool argument previews, result/error previews, and shell arg segments |
| Pending tool components | TUI state `pendingTools` | Tool handlers/renderers |
| Assistant message split | TUI `streamingComponent` | Preserves text before and after tool calls |

## Key files

- `packages/core/src/harness/harness.ts` — emits tool input events and owns display-state buffers.
- `packages/core/src/harness/display-state.test.ts` — core buffer/status coverage.
- `mastracode/src/tui/event-dispatch.ts` — routes input events to handlers.
- `mastracode/src/tui/handlers/tool.ts` — creates early components and parses partial JSON.
- `mastracode/src/tui/components/tool-execution-enhanced.ts` — renders and updates argument previews, quiet shell command previews, and bounded error parsing.
- `mastracode/src/tui/components/ansi.ts` — shared bounded ANSI/OSC truncation used by streamed tool renderers.
- `packages/core/src/utils.ts`, `tool-call-step.ts`, and MastraCode tool renderers — safe serialization path for circular tool results before display/history projections.
- `mastracode/src/tui/render-messages.ts` — reload/history rendering from final tool calls.
- `mastracode/src/tui/components/task-progress.ts` — pinned task progress projection for task mutation tools.

## Dependencies / related features

- [Coding tools and approval permissions](./coding-tools-permissions.md) — tool execution surface, result serialization, and approval/error renderers.
- [Workspace-backed coding tools](./workspace-tools.md) — workspace tool calls are rendered through the streaming tool UI.
- [Task tracking tools and TUI progress](./task-tracking.md) — task tools are the main special-case renderer.
- [Interactive TUI chat](../tui/interactive-chat.md) — streaming chat renderer.
- [Harness display state](../integrations/harness-display-state.md) — canonical active tool/input-buffer projection.
- [Persistent conversations / switching](../threads/persistent-conversations.md) — history reconstruction path.

## Existing tests

- `packages/core/src/harness/display-state.test.ts` covers `tool_input_start/delta/end` buffers and streaming-input status.
- `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts` covers preview updates from partial args plus pathological-input timing for bounded error parsing.
- `mastracode/src/tui/components/__tests__/ansi.test.ts` covers ANSI/OSC visible-width truncation and a no-ReDoS pathological case.
- `packages/core/src/utils.test.ts` covers safe circular-reference serialization helpers used by tool results.
- `mastracode/src/tui/components/__tests__/ask-question-inline-long-labels.test.ts` covers streaming inline question args.
- `mastracode/src/tui/components/__tests__/task-progress.test.ts` covers pinned task progress rendering.

## Missing tests

- Covered by `mastracode/src/tui/handlers/__tests__/tool.test.ts`: `handleToolInputDelta()` parses canonical display-state buffered partial JSON into `pendingTools`, refreshes/renders the component, and ignores deltas without a buffer.
- E2E coverage: `mastracode/scripts/mc-e2e/scenarios/streaming-tool-args.ts` submits a real TUI prompt, uses AIMock's first-class streamed `response.toolCalls` fixture for the real `view` tool, slows argument chunks with `streamingProfile`/`chunkSize`, asserts partial `view src/streaming-args.ts` args render before the final range, then asserts the executed tool result renders `src/streaming-args.ts:12-18` and a line from the fixture file.
- Covered by `mastracode/scripts/mc-e2e/scenarios/tool-history-reload.ts`: seeds completed persisted `view`, provider web-search, and task tool calls/results, opens the thread through `/threads`, and proves final args/results reconstruct from history without replaying partial deltas.
- Remaining supporting gap: pre-tool assistant text around task mutation streaming and circular-result sanitization are covered below e2e by component/core tests rather than a dedicated TUI scenario.

## Known risks / regressions

- Partial JSON parsing can silently skip malformed chunks until enough text arrives.
- Live streaming and history reload are intentionally different projections; regressions can hide if only one path is tested.
- Task tools have special pinned-state behavior and can diverge from generic tool boxes.
- Safe JSON serialization is not the same as output budgeting; circular results can still be large if a renderer skips truncation.
- New renderer regexes should stay bounded/procedural; timing tests cover known pathological shapes but are not a substitute for reviewing regex structure.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
