# Task tracking tools and TUI progress

## Origin PR / commit

- PR: [#13344](https://github.com/mastra-ai/mastra/pull/13344) — moved todo tools into core Harness and renamed them to task tools.
- Later changes: [#13427](https://github.com/mastra-ai/mastra/pull/13427) — moved current/previous task snapshots into `HarnessDisplayState` for UI rendering and history reconciliation; [#15192](https://github.com/mastra-ai/mastra/pull/15192) — clears task/plan/access projections on thread switch or creation so stale global task state does not leak across threads; [#15749](https://github.com/mastra-ai/mastra/pull/15749) — broadens thread-boundary cleanup to reset task progress UI, `taskToolInsertIndex`, queued state, and other per-thread TUI projections on switch/create/clone; [#16254](https://github.com/mastra-ai/mastra/pull/16254) — adds stable patch tools (`task_update`, `task_complete`, `task_check`) plus deterministic task ID assignment; [#16843](https://github.com/mastra-ai/mastra/pull/16843) — auto-demotes extra `in_progress` tasks during single-task patch updates while preserving full-list validation.

## User-visible behavior

- Agents maintain a structured task list with `task_write`, `task_update`, `task_complete`, and `task_check`.
- Success: tool results, pinned TUI progress, prompt context, and reload/history agree on the same tasks; single-task patch tools update the existing list without rewriting unrelated items.
- Must preserve: stable task IDs, one `in_progress` task, deterministic ID reuse/deduplication, no stale tasks across threads, no stale active plans, sandbox approvals, task insertion indexes, or task progress UI across thread boundaries, no parent task tools in non-forked execute subagents.

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
| Task list/mutations | Core Harness state + task tools; `assignTaskIds()` gives deterministic stable IDs and patch tools mutate by ID | Runtime, prompt, TUI, headless |
| Single-task patch semantics | `task_update`, `task_complete`, `task_check`, and `demoteExtraInProgress()` in core Harness tools | Agent task maintenance without full-list rewrites; user-visible status summaries; automatic cleanup of accidental multiple active tasks on patch updates |
| Task display snapshots | `HarnessDisplayState.tasks` / `previousTasks` | TUI progress + history reconciliation |
| Pinned/inline projection | TUI `TaskProgressComponent` + `taskToolInsertIndex` | Interactive chat |
| Thread boundary reset | `event-dispatch.ts` handles `thread_changed` / `thread_created` by clearing tasks, active plan, sandbox allowed paths, task insert index, and live task progress component | Thread switch/create UI and prompt context |
| Prompt snapshot | `buildFullPrompt()` from Harness state | Model context |

## Key files

- `packages/core/src/harness/tools.ts` — task schemas, deterministic ID assignment/reuse, full-list and single-task state mutation, `task_updated`, and `task_check` summaries.
- `packages/core/src/harness/task-tools.test.ts` — stable task ID assignment, duplicate disambiguation, patch tool mutation/error behavior, and completion checks.
- `packages/core/src/harness/harness.ts` — built-in task tool injection and display state.
- `mastracode/src/tui/components/task-progress.ts`, `tui/event-dispatch.ts`, `tui/handlers/tool.ts` — TUI projections and thread-boundary cleanup.
- `mastracode/src/tui/commands/new.ts` and `mastracode/src/tui/commands/clone.ts` — explicit TUI reset paths for new/cloned threads, component caches, task state, active plan, sandbox paths, and `taskToolInsertIndex`.
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
- `packages/core/src/harness/task-tools.test.ts` covers `assignTaskIds()`, explicit/implicit ID reuse, duplicate ID/content disambiguation, `task_update`, `task_complete`, and `task_check` summaries/error paths.
- MC TUI tests cover `TaskProgressComponent`, `task_updated` dispatch, completed/cleared inline rendering, prompt task injection, and `event-dispatch.test.ts` thread boundary resets for tasks/active plan/sandbox paths/task insert index/task progress component.
- `mastracode/src/agents/subagents/execute.test.ts` covers task tools not being exposed to non-forked execute subagents.

## Missing tests

- End-to-end live TUI test where streamed task input, `task_updated`, pinned progress, final history, and prompt context agree.
- Covered by `packages/core/src/harness/task-tools.test.ts`: compatibility-path task tools read restored tasks from `getState()` when the direct state projection is stale, persist mutations through `setState()`, and emit `task_updated` so UI/progress and tool state stay aligned.

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
