# Task tracking tools and TUI progress

## Origin PR / commit

- PR: [#13344](https://github.com/mastra-ai/mastra/pull/13344) — moved todo tools into core Harness and renamed them to task tools.
- Later changes: [#13427](https://github.com/mastra-ai/mastra/pull/13427) — moved current/previous task snapshots into `HarnessDisplayState` for UI rendering and history reconciliation.

## User-visible behavior

- Agents maintain a structured task list with `task_write`, `task_update`, `task_complete`, and `task_check`.
- Success: tool results, pinned TUI progress, prompt context, and reload/history agree on the same tasks.
- Must preserve: stable task IDs, one `in_progress` task, no stale tasks across threads, no parent task tools in non-forked execute subagents.

## Entry points / commands

- Automatic: model task tool calls and `task_updated` Harness events.
- Visible UI: pinned `TaskProgressComponent`, completed/cleared inline summaries, `<current-task-list>` prompt injection.

## TUI states

- Active: incomplete tasks render pinned above the editor; quiet mode compacts completed task transitions from the same state.
- Completed/cleared: inline transition renders at the recorded task-tool insertion point.

## Headless / non-TUI behavior

- Core Harness owns task tools/events, so non-TUI consumers share the same task state.
- Headless has no pinned progress view; users see task tool result text only.

## Streaming / loading / interrupted states

- Streaming: task mutation input uses tool-input events; the pinned projection updates from `task_updated`.
- Thread new/change/clone clears task projections and resets task insertion state.

## Streaming vs loaded-from-history behavior

- Active streaming: TUI uses `pendingTaskToolIds`, `taskToolInsertIndex`, and live `task_updated` events.
- Loaded from history: completed/cleared task transitions are reconstructed from stored tool calls/results; prompt state comes from Harness state.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Task list/mutations | Core Harness state + task tools | Runtime, prompt, TUI, headless |
| Task display snapshots | `HarnessDisplayState.tasks` / `previousTasks` | TUI progress + history reconciliation |
| Pinned/inline projection | TUI `TaskProgressComponent` + `taskToolInsertIndex` | Interactive chat |
| Prompt snapshot | `buildFullPrompt()` from Harness state | Model context |

## Key files

- `packages/core/src/harness/tools.ts` — task schemas, ID assignment, state mutation, `task_updated`.
- `packages/core/src/harness/harness.ts` — built-in task tool injection and display state.
- `mastracode/src/tui/components/task-progress.ts`, `tui/event-dispatch.ts`, `tui/handlers/tool.ts` — TUI projections.
- `mastracode/src/agents/prompts/index.ts`, `mastracode/src/permissions.ts` — prompt injection and always-allowed policy.

## Dependencies / related features

- [Streaming tool arguments](./streaming-tool-arguments.md) — task tools are the main special-case renderer.
- [Harness display state](../integrations/harness-display-state.md) — owns task snapshots for UI display.
- [Coding tools and approval permissions](./coding-tools-permissions.md) — task tools bypass approval.
- [Persistent conversations / switching](../threads/persistent-conversations.md) — task state is thread-local.
- [Subagent delegation](../subagents/delegation.md) — non-forked execute subagents must not mutate parent tasks.
- [Quiet mode](../tui/quiet-mode.md) — completed task transitions can compact in quiet mode.

## Existing tests

- Core Harness display-state/task tests cover `task_updated`, task mutation, replay, and subagent restrictions.
- MC TUI tests cover `TaskProgressComponent`, `task_updated` dispatch, completed/cleared inline rendering, and prompt task injection.
- `mastracode/src/agents/subagents/execute.test.ts` covers task tools not being exposed to non-forked execute subagents.

## Missing tests

- End-to-end live TUI test where streamed task input, `task_updated`, pinned progress, final history, and prompt context agree.
- Reload/headless regression for the original split-brain failure: UI/prompt show tasks but task tools cannot find them.

## Known risks / regressions

- Task state is projected into Harness state, prompt XML, pinned TUI UI, history renderers, and tool results.
- Thread cleanup/reload can erase or leak tasks if active-thread ownership is wrong.
- Task tools are always allowed; registration/prompt/runtime restrictions must stay aligned.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
