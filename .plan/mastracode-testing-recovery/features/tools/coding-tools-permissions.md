# Coding tools and approval permissions

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — introduced file/shell/search/LSP/subagent coding tools, tool approval rendering, permissions, YOLO mode, hooks, and MCP tool integration in the initial port.
- Commit: `0e64154f1b` — `MastraCode initial port (#13218)`.

## User-visible behavior

The agent can inspect files, search code, edit/write files, run shell commands, inspect symbols, spawn subagents, use web search/extract, request access to paths outside the sandbox, and call MCP tools. Riskier tool calls require approval unless YOLO mode or policies allow them. Users can view/change category policies and toggle YOLO.

## Entry points / commands

- Agent tool calls during normal chat.
- `/permissions` displays category policies, per-tool overrides, and session grants; `/permissions set <category> <allow|ask|deny>` changes a category (`mastracode/src/tui/commands/permissions.ts:3`).
- `/yolo` toggles auto-approval for all tools; Ctrl+Y also toggles YOLO (`mastracode/src/tui/setup.ts:158`).
- Tool approval dialogs appear from `tool_approval_required` events (`mastracode/src/tui/event-dispatch.ts:88`).
- Plan mode disables write/edit/AST edit workspace tools (`mastracode/src/agents/workspace.ts:146`).

## TUI states

- Tool starts/updates/ends render through event dispatch and tool handlers (`mastracode/src/tui/event-dispatch.ts:84`).
- Tool input can stream as `tool_input_start`, `tool_input_delta`, and `tool_input_end` (`mastracode/src/tui/event-dispatch.ts:105`).
- Approval-required state tracks interactive prompts for analytics and displays approval UI (`mastracode/src/tui/event-dispatch.ts:88`).
- Ctrl+E expands/collapses all tool/slash/shell/system reminder components (`mastracode/src/tui/setup.ts:119`).
- YOLO state is stored in harness state and reflected by `/permissions` (`mastracode/src/tui/commands/permissions.ts:28`).

## Headless / non-TUI behavior

Headless uses the same harness/tools/permission engine but does not have modal TUI approval affordances. For automation, tool permissions must be configured so the run can proceed without interactive prompts, or the run may block/fail depending on approval requirements. Headless still routes through `createMastraCode()` and the same dynamic tool/workspace setup.

## Streaming / loading / interrupted states

- Shell output can stream separately from final tool result (`mastracode/src/tui/event-dispatch.ts:101`).
- Tool arguments can stream incrementally before execution (`mastracode/src/tui/event-dispatch.ts:105`).
- Aborting an active run should dismiss active approval/question UI and call `harness.abort()` (`mastracode/src/tui/setup.ts:50`).
- Hook wrappers run `PreToolUse` before execution and `PostToolUse` in `finally`, including error cases (`mastracode/src/agents/tools.ts:62`).

## Streaming vs loaded-from-history behavior

During streaming, each tool has live component state in `pendingTools`, tool input buffers, shell stream components, and approval UI state. Loaded-from-history behavior depends on persisted harness messages/tool events being renderable by `renderExistingMessages()`. Live-only state like pending approval callbacks, active shell streams, and session grants is not recreated as active work after reload. Tool result history can be shown, but an interrupted approval or in-flight shell command should not silently resume unless harness/session logic explicitly supports it.

## State ownership

- Tool definitions: workspace + `createDynamicTools()` are authoritative; MCP/extra tools are merged dynamically (`mastracode/src/agents/tools.ts:95`).
- Workspace filesystem/shell/LSP tools: `getDynamicWorkspace()` owns project root, allowed paths, and mode-specific disabled write tools (`mastracode/src/agents/workspace.ts:130`).
- Permission category mapping/defaults: `mastracode/src/permissions.ts` is authoritative.
- Permission rules and YOLO: harness state/session is authoritative; TUI commands mutate it.
- Session grants: harness/session grant state; reset on restart by design.
- Tool rendering: TUI component maps are projections of live/persisted harness events.
- Hook side effects: `HookManager` owns lifecycle execution around tools.

## Key files

- `mastracode/src/agents/tools.ts` — dynamic non-workspace tools, web search, MCP merge, hook wrapping, disabled/denied filtering.
- `mastracode/src/agents/workspace.ts` — workspace-backed file/search/shell/LSP tools and sandbox paths.
- `mastracode/src/permissions.ts` — category mapping, defaults, YOLO policies, approval decision engine.
- `mastracode/src/tui/commands/permissions.ts` — `/permissions` UI.
- `mastracode/src/tui/commands/yolo.ts` — `/yolo` command.
- `mastracode/src/tui/event-dispatch.ts` — tool lifecycle event routing.
- `mastracode/src/hooks/manager.ts` — hook lifecycle around tools.

## Dependencies / related features

- [Interactive TUI chat](../tui/interactive-chat.md) — tool components render inside chat streams/history.
- [Model auth and modes](../models/model-auth-and-modes.md) — plan mode changes available write tools; model family affects web search fallback.

## Existing tests

- `mastracode/src/tools/__tests__/file-editor.test.ts` — file editing behavior.
- `mastracode/src/lsp/__tests__/string-replace-lsp.test.ts` — smart replacement/LSP behavior.
- `mastracode/src/__tests__/tool-approval-libsql.test.ts` — persisted approval flow.
- `mastracode/src/agents/tools.test.ts` and `mastracode/src/agents/extra-tools.test.ts` — dynamic tool creation/filtering.
- `mastracode/src/tui/handlers/tool.test.ts` — TUI tool rendering behavior.
- `mastracode/src/tui/commands/__tests__/permissions.test.ts` — permissions command behavior.

## Missing tests

- Reload test proving completed tool components render from history the same way they streamed live.
- Interrupted approval test: active approval is dismissed on abort and not restored as pending after reload.
- Plan-mode regression test proving write/edit tools are hidden/disabled in both prompt context and runtime tool set.
- Headless permission behavior test for non-interactive runs.

## Known risks / regressions

- Harness v1 migration risk: permission state, session grants, visible tool list, and runtime tool availability can drift.
- Denied tools are removed from `createDynamicTools()`, but workspace tool visibility depends on workspace tool config; verify both paths for every permission change.
- Slack task-state regression is adjacent: task tools are specialized tool calls whose rendered state and prompt/runtime state must stay synchronized.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
