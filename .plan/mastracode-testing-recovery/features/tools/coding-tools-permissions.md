# Coding tools and approval permissions

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — coding tools, approvals, permissions, YOLO, hooks, MCP tool merge.
- Later changes: [#13231](https://github.com/mastra-ai/mastra/pull/13231) — context-aware dynamic tools and execution-mode availability; [#13245](https://github.com/mastra-ai/mastra/pull/13245) — moved tool approvals, questions, and plan approval primitives into core Harness.

## User-visible behavior

- What the user can do: let the agent read/search/edit files, run shell, inspect symbols, use web/MCP tools, and request path access.
- Success looks like: risky tools ask unless policy/session grants/YOLO allow them.
- Must preserve: visible tool list, runtime tool availability, prompt guidance, and approval UI stay aligned.

## Entry points / commands

- Commands / shortcuts / flags: agent tool calls, `/permissions`, `/yolo`, Ctrl+Y, approval dialogs.
- Automatic triggers: dynamic tool creation, PreToolUse/PostToolUse hooks, permission resolution.

## TUI states

- Idle: `/permissions` shows policies, grants, YOLO state.
- Active / modal / error: tool streaming, shell output, approval prompt, abort cleanup.

## Headless / non-TUI behavior

- Supported: same harness/tools/permission engine.
- Not supported / unknown: modal approvals are TUI-specific; non-interactive runs need preconfigured permissions or clear failure.

## Streaming / loading / interrupted states

- Streaming / loading: tool args, shell output, and results can stream as separate events.
- Abort / retry / resume: active approvals/questions should dismiss; in-flight tool state should not be restored as active after reload unless explicitly supported.

## Streaming vs loaded-from-history behavior

- While actively streaming: TUI owns pending tool components, input buffers, shell streams, and approval callbacks.
- After reload / history reconstruction: completed tool history may render; pending approvals/session grants are live-only.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Tool definitions | Workspace + `createDynamicTools()` + MCP manager | Runtime, prompt guidance |
| Permission policies | Harness state / permission rules | Approval engine, `/permissions` |
| YOLO | Harness state | Approval engine, status/commands |
| Session grants | Harness session | Approval engine only |
| Tool rendering | Harness events/history | TUI projections |

## Key files

- `mastracode/src/agents/tools.ts` — dynamic tools, web search, MCP merge, hooks.
- `mastracode/src/agents/workspace.ts` — filesystem/shell/LSP tools and sandbox paths.
- `mastracode/src/permissions.ts` — category mapping and approval rules.
- `mastracode/src/tui/commands/permissions.ts` — `/permissions`.
- `mastracode/src/tui/commands/yolo.ts` — `/yolo`.
- `mastracode/src/tui/event-dispatch.ts` — tool event routing.
- `mastracode/src/hooks/manager.ts` — hook lifecycle.

## Dependencies / related features

- [Interactive TUI chat](../tui/interactive-chat.md) — tool components render in chat/history.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — plan mode and model family affect tools.
- [Subagent delegation](../subagents/delegation.md) — subagents rely on workspace tool boundaries.

## Existing tests

- `mastracode/src/tools/__tests__/file-editor.test.ts` — edit behavior.
- `mastracode/src/lsp/__tests__/string-replace-lsp.test.ts` — LSP replacement.
- `mastracode/src/__tests__/tool-approval-libsql.test.ts` — persisted approval flow.
- `mastracode/src/agents/tools.test.ts`, `extra-tools.test.ts` — dynamic tools.
- `mastracode/src/tui/handlers/tool.test.ts`, `commands/__tests__/permissions.test.ts` — rendering/commands.

## Missing tests

- Completed streamed tool call renders the same after reload.
- Interrupted approval is dismissed and not restored pending after reload.
- Plan-mode runtime tools and prompt guidance both hide write tools.
- Headless non-interactive permission behavior.

## Known risks / regressions

- Harness v1 risk: permission state, visible tools, prompt guidance, and runtime tools can drift.
- Denied non-workspace tools are filtered in `createDynamicTools()`; workspace tool visibility must be verified separately.
- Task-state Slack regression is adjacent because task tools also need rendered/prompt/runtime state sync.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
