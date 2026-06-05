# Coding tools and approval permissions

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — coding tools, approvals, permissions, YOLO, hooks, MCP tool merge.
- Later changes: [#13231](https://github.com/mastra-ai/mastra/pull/13231) — context-aware dynamic tools and execution-mode availability; [#13245](https://github.com/mastra-ai/mastra/pull/13245) — moved tool approvals, questions, and plan approval primitives into core Harness; [#13250](https://github.com/mastra-ai/mastra/pull/13250) — fixed packaged ESM startup for LSP-backed tools; [#13253](https://github.com/mastra-ai/mastra/pull/13253) — fixed Zod v3/v4 schema routing for tool input schemas; [#13328](https://github.com/mastra-ai/mastra/pull/13328) — streamed tool arguments into live renderers; [#13344](https://github.com/mastra-ai/mastra/pull/13344) — moved task/todo tools into core Harness built-ins; [#13311](https://github.com/mastra-ai/mastra/pull/13311) — wired the TUI `/mcp` status/reload command to the real MCP manager; [#13347](https://github.com/mastra-ai/mastra/pull/13347) — refactored MCP manager construction to `createMcpManager()` without changing MCP tool merge behavior; [#13348](https://github.com/mastra-ai/mastra/pull/13348) — capped file/search/web tool result output around 2k tokens; [#13355](https://github.com/mastra-ai/mastra/pull/13355) — allowed the old unified `view` tool's `view_range` to paginate directory listings; [#13385](https://github.com/mastra-ai/mastra/pull/13385) — fixed TS/JS LSP language IDs; [#13384](https://github.com/mastra-ai/mastra/pull/13384) — fixed hidden-file exclusion for the old directory-listing implementation; [#13428](https://github.com/mastra-ai/mastra/pull/13428) — fixed `view` rendering for core workspace `read_file` output; [#13437](https://github.com/mastra-ai/mastra/pull/13437) — migrated file/edit/shell/LSP coding tools to core Workspace; [#13442](https://github.com/mastra-ai/mastra/pull/13442) — completed live TUI lifecycle hook wiring for `Stop` and `UserPromptSubmit`; [#13519](https://github.com/mastra-ai/mastra/pull/13519) — fixed persisted approval resume for standalone/storage-backed agents; [#13526](https://github.com/mastra-ai/mastra/pull/13526) — aligned edit-tool path resolution with command execution/project root semantics; [#13564](https://github.com/mastra-ai/mastra/pull/13564) — wires config `extraTools` into the dynamic tool builder and keeps denied tools out of both runtime and prompt guidance; [#13609](https://github.com/mastra-ai/mastra/pull/13609) — adds OpenAI native `web_search` fallback when Tavily is absent; [#13687](https://github.com/mastra-ai/mastra/pull/13687) — aligns permission categories, guidance, subagent allowlists, and TUI special cases around remapped `MC_TOOLS` names; [#13696](https://github.com/mastra-ai/mastra/pull/13696) — queues parallel question/access prompts so approvals do not corrupt input routing; [#13713](https://github.com/mastra-ai/mastra/pull/13713) — allows `extraTools` to be a request-context-aware function; [#13724](https://github.com/mastra-ai/mastra/pull/13724) — updates tool guidance to match gitignore-aware list/search behavior; [#13753](https://github.com/mastra-ai/mastra/pull/13753) — renames sandbox access to `request_access`, fixes tilde expansion, and applies approved paths to the active workspace; [#13611](https://github.com/mastra-ai/mastra/pull/13611) — keeps the agent's dynamic tool injection on the shared auth/model setup path; [#13870](https://github.com/mastra-ai/mastra/pull/13870) — gives web-search calls a dedicated TUI renderer so provider JSON/encrypted blobs do not leak into normal output; [#13999](https://github.com/mastra-ai/mastra/pull/13999) — streams local `!` shell passthrough output in real time; [#14157](https://github.com/mastra-ai/mastra/pull/14157) — fixes Zod v4 tool schema JSON Schema export for provider tool calls; [#14168](https://github.com/mastra-ai/mastra/pull/14168) — stops replacing tool validation errors with a generic message and surfaces the actual validation text; [#14565](https://github.com/mastra-ai/mastra/pull/14565) — adds `lsp_inspect` as a read-category workspace tool with prompt guidance, permission category, and TUI renderer; [#14535](https://github.com/mastra-ai/mastra/pull/14535) — adds safe serialization for circular tool results so MCP/custom tool outputs cannot crash JSON-stringify boundaries; [#15566](https://github.com/mastra-ai/mastra/pull/15566) — hardens tool validation/error parsing and ANSI rendering regexes with bounded/procedural alternatives so attacker-shaped tool output cannot trigger polynomial backtracking; current core tools now own file/list/LSP behavior.

## User-visible behavior

- What the user can do: let the agent read/search/edit/list files, run shell, inspect symbols, use web/MCP tools, and request path access. When Tavily is absent, Anthropic/OpenAI models can still expose native provider web search.
- Success looks like: risky tools ask unless policy/session grants/YOLO allow them; configured extra tools appear when allowed and denied tools disappear everywhere; tool validation failures show the concrete missing/invalid parameter message instead of a generic placeholder; circular tool results render with `[Circular]` markers instead of crashing the run.
- Must preserve: visible tool list, runtime tool availability, prompt guidance, approval UI, bounded/serializable tool output, accurate schema serialization, actionable validation errors, and ReDoS-safe parsing/rendering stay aligned.

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
- Abort / retry / resume: active approvals/questions should dismiss; approval resume for stored runs must reload workflow snapshots through Harness storage and continue the stream after approve/decline.

## Streaming vs loaded-from-history behavior

- While actively streaming: TUI owns pending tool components, input buffers, shell streams, and approval callbacks.
- After reload / history reconstruction: completed tool history may render; pending approvals/session grants are live-only.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Tool definitions/results | Workspace + `createDynamicTools()` + `McpManager` interface + config `extraTools` (static record or request-context function) + provider web-search fallback + schema compatibility wrappers; core `ensureSerializable()` sanitizes tool execution results; bounded validation/error/ANSI parsers protect TUI renderers from pathological tool text | Runtime, prompt guidance, provider tool-call schemas, TUI/history renderers |
| Access requests | `request_access` tool + Harness question resolver + workspace filesystem allowed paths | Approval UI, same-turn file/list/search/edit tools |
| Stable tool categories | `MC_TOOLS` constants after workspace name remap, including `LSP_INSPECT` as read-category code intelligence | Permission rules, denied-tool filtering, subagent allowlists, TUI render cases |
| Permission policies | Harness state / permission rules | Approval engine, `/permissions`, dynamic tool filtering |
| YOLO | Harness state | Approval engine, status/commands |
| Session grants | Harness session | Approval engine only |
| Tool rendering/errors/results | Harness events/history, with dedicated renderers for view/edit/shell/task/web-search shapes; local shell passthrough uses its own live component; `showFormattedError()` / tool renderers preserve validation text; shared `safeStringify()` handles circular object payloads | TUI projections |
| Tool output budget | Core workspace output helpers + MC web-tool wrappers | Model context, TUI/history renderers |
| File/directory viewing | Core workspace `read_file` / `list_files` tools with gitignore-aware listing | Agent runtime, prompt guidance |
| Interactive prompt queue | TUI `activeInlineQuestion` + `pendingInlineQuestions` | `ask_user`, `request_access`, abort cleanup |
| View output rendering | TUI `ToolExecutionComponentEnhanced` | Live tool UI and history-rendered tool calls |
| Hidden-file visibility | `list_files.showHidden` + tree formatter filter | Directory listings |
| LSP language/query output | Core workspace LSP `getLanguageId()` mapping + `lspInspectTool` result shape | `lsp_inspect`, edit diagnostics, TUI renderer |
| Edit tool path resolution | Workspace filesystem rooted at project base path | `string_replace_lsp`, `ast_smart_edit`, read-before-write tracking |
| Tool hooks | `HookManager` + dynamic tool wrapper | `PreToolUse` / `PostToolUse` execution boundaries |
| Approval resume snapshots | Core Harness internal Mastra + workflow storage | `approveToolCall()` / `declineToolCall()` / resumed streams |

## Key files

- `mastracode/src/agents/tools.ts` — dynamic tools, Tavily/native provider web search, MCP merge, config `extraTools` (record or function), denied-tool filtering, hooks.
- `mastracode/src/agents/prompts/tool-guidance.ts` — tool usage guidance, including gitignore-aware `find_files` / `search_content`, `lsp_inspect` marker usage, and denied-tool filtering.
- `mastracode/src/mcp/manager.ts` — MCP manager factory/interface that supplies tools to `createDynamicTools()`.
- `mastracode/src/tui/commands/mcp.ts` — MCP status/reload command that reads the same manager.
- `mastracode/src/agents/workspace.ts` — workspace provisioning, plan-mode tool filtering, and sandbox paths.
- `mastracode/src/tools/request-sandbox-access.ts` — Mastra Code-owned custom tool schema.
- `mastracode/src/lsp/client.ts` — JSON-RPC client used by LSP-backed tools.
- `packages/schema-compat/src/zod-to-json.ts` and `packages/schema-compat/src/standard-schema/adapters/zod-v4.ts` — Zod/Standard Schema tool-schema conversion.
- `mastracode/src/tools/web-search.ts` — MC web-search/web-extract string formatting and 2k token truncation.
- `packages/core/src/workspace/tools/output-helpers.ts` — core workspace output truncation default (`DEFAULT_MAX_OUTPUT_TOKENS = 2_000`).
- `packages/core/src/workspace/tools/read-file.ts` — current file read tool with `offset` / `limit` line ranges.
- `packages/core/src/workspace/tools/edit-file.ts`, `ast-edit.ts` — current edit tools (`string_replace_lsp`, `ast_smart_edit`).
- `packages/core/src/workspace/filesystem/local-filesystem.ts` — project-root path containment and helpful absolute-path hints.
- `mastracode/src/tui/components/tool-execution-enhanced.ts` — TUI render cases for tools, including view/edit/shell/list/task/web-search compact renderers, bounded error parsing, and validation error details.
- `mastracode/src/tui/components/tool-approval-dialog.ts`, `tool-validation-error.ts`, `ansi.ts`, `subagent-execution.ts`, and `tui/handlers/tool.ts` — TUI result/approval/error renderers using safe stringification for object payloads plus bounded validation-error and ANSI/OSC parsing.
- `mastracode/src/tui/display.ts` and `mastracode/src/utils/errors.ts` — formatted run/error display that preserves actual validation messages and parsed details instead of generic validation placeholders.
- `packages/core/src/workspace/tools/list-files.ts` — current directory listing tool and `showHidden` input.
- `packages/core/src/workspace/tools/tree-formatter.ts` — filters dotfiles/dot-directories unless `showHidden` is true.
- `packages/core/src/workspace/tools/lsp-inspect.ts` — current `lsp_inspect` schema, marker parsing, query fan-out, and result shaping.
- `packages/core/src/utils.ts` and `utils.test.ts` — `safeStringify()` / `ensureSerializable()` handling circular references and BigInt values at JSON boundaries.
- `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts` — sanitizes raw tool execution results before output hooks/chunks receive them.
- `packages/core/src/workspace/lsp/language.ts`, `manager.ts`, `client.ts` — current LSP language mapping, query preparation, diagnostics waiting, and hover/definition/implementation requests.
- `mastracode/src/lsp/language.ts` — legacy MC-local mapping retained for older LSP paths.
- `mastracode/src/permissions.ts` — category mapping and approval rules.
- `mastracode/src/tui/commands/permissions.ts` — `/permissions`.
- `mastracode/src/tui/commands/yolo.ts` — `/yolo`.
- `mastracode/src/tui/event-dispatch.ts` — tool event routing.
- `mastracode/src/tui/render-messages.ts` — reconstructs completed tool calls from history with the same tool component.
- `mastracode/src/hooks/manager.ts` — hook lifecycle.
- `packages/core/src/harness/harness.ts` — internal Mastra/storage registration for standalone approval resume.
- `packages/core/src/workflows/entry.ts` and `packages/core/src/workflows/default.ts` — workflow snapshot persistence and JSON-safe request-context serialization.

## Dependencies / related features

- [Workspace-backed coding tools](./workspace-tools.md) — core Workspace owns file/edit/shell/LSP tool implementations.
- [MCP server configuration](../integrations/mcp-server-configuration.md) — configured MCP tools join the same runtime/permission surface.
- [Tool schema compatibility](../models/tool-schema-compatibility.md) — provider JSON Schema conversion for tool input schemas.
- [Streaming tool arguments](./streaming-tool-arguments.md) — live partial tool input rendering.
- [Shell passthrough streaming](../tui/shell-passthrough.md) — local `!` shell commands stream separately from permissioned agent shell tools.
- [Interactive TUI chat](../tui/interactive-chat.md) — expanded/collapsed tool renderers are embedded in chat/history.
- [Interactive prompts and access requests](../tui/interactive-prompts.md) — `request_access` prompts share the queued inline prompt path.
- [Task tracking tools and TUI progress](./task-tracking.md) — always-allowed task tools and pinned progress projection.
- [MCP status and reload command](../integrations/mcp-status-command.md) — MCP manager status must match merged runtime tools.
- [Lifecycle hooks](../integrations/lifecycle-hooks.md) — hook decisions can block tool execution before the runtime tool runs.
- [GitHub issue reporting command](../integrations/github-issue-reporting.md) — issue workflow asks the agent to run `gh` commands through normal shell/tool policy.
- [Interactive TUI chat](../tui/interactive-chat.md) — tool components render in chat/history.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — plan mode and model family affect tools.
- [Core Harness API and reference docs](../integrations/harness-api.md) — owns the approval API and internal storage registration used by resume.
- [Subagent delegation](../subagents/delegation.md) — subagents rely on workspace tool boundaries.
- [Web search tool rendering](./web-search-rendering.md) — specializes TUI output for native/Tavily web-search result shapes.

## Existing tests

- `packages/core/src/workspace/tools/__tests__/edit-file.test.ts` — current exact-string edit behavior.
- `packages/core/src/workspace/filesystem/local-filesystem.test.ts` — absolute-path containment and relative-path hint behavior for project-root resolution.
- `packages/core/src/workspace/tools/__tests__/lsp-inspect.test.ts` — current LSP inspect wrapper, marker validation, result shaping, path handling, and cleanup.
- `mastracode/src/tools/__tests__/project-root-resolution.test.ts` — original #13526 regression coverage before the later core workspace-tools migration.
- `mastracode/src/tools/__tests__/file-editor.test.ts` and `mastracode/src/lsp/__tests__/string-replace-lsp.test.ts` — legacy MC-owned paths from before core workspace migration.
- `mastracode/src/__tests__/tool-approval-libsql.test.ts` — persisted approval flow.
- `packages/core/src/agent/__tests__/tool-approval-standalone-repro.test.ts` — standalone approval/suspend resume regressions, including input processors and dynamically loaded tools.
- `mastracode/src/agents/tools.test.ts`, `extra-tools.test.ts` — dynamic tools, including request-context-aware extraTools functions and pre/post tool hook wrapping.
- `mastracode/src/tui/__tests__/parallel-interactive-prompts.test.ts` — queued `ask_user` / `request_access` prompt behavior for parallel tool calls.
- `mastracode/src/tools/__tests__/request-sandbox-access.test.ts` — `request_access` approval/denial, tilde expansion, and active-filesystem allowed-path mutation.
- `packages/schema-compat/src/zod-to-json.test.ts` and `packages/schema-compat/src/standard-schema/adapters/zod-v4.test.ts` — Zod / Standard Schema conversion coverage.
- `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts` — quiet validation error rendering coverage plus bounded `parseErrorFromContent()` pathological-input timing regression.
- `mastracode/src/tui/components/__tests__/ansi.test.ts` and `tool-validation-error.test.ts` — bounded ANSI/OSC truncation and validation-error parsing, including no-ReDoS pathological inputs.
- `mastracode/src/tui/handlers/tool.test.ts`, `commands/__tests__/permissions.test.ts` — rendering/commands.
- `mastracode/src/tui/__tests__/shell.test.ts` and `shell-result.test.ts` — local shell passthrough subprocess invocation and completion diagnostics.
- `packages/core/src/workspace/tools/__tests__/read-file.test.ts` — file `offset` / `limit`, range validation, large-output token caps.
- `packages/core/src/workspace/tools/__tests__/list-files.test.ts` — directory listing behavior, hidden-file default exclusion / `showHidden`, and token caps.
- `packages/core/src/utils.test.ts` — circular-reference, shared-reference, BigInt, and serializable-object behavior for safe serialization helpers.

## Missing tests

- Completed streamed tool call renders the same after reload, including sanitized circular-result payloads.
- Component-level local shell passthrough test for incremental stdout/stderr output, output caps, and partial-line flushing.
- Interrupted approval is dismissed and not restored pending after reload.
- Plan-mode runtime tools and prompt guidance both hide write tools.
- Headless non-interactive permission behavior.
- Reloaded approval resume path through the actual Mastra Code TUI/headless wrapper, not only direct core Agent/Harness tests.
- Packaged `mastracode` startup/import smoke test that catches ESM subpath regressions like `vscode-jsonrpc/node` vs `vscode-jsonrpc/node.js`.
- End-to-end tool-call schema serialization test for source checkout and global install Zod resolution.
- MC web-search/web-extract truncation test proving Tavily results are serialized to bounded text.
- Direct test that OpenAI models get native `web_search` when Tavily is absent, plus prompt guidance parity for the same condition.
- Regression test for the old #13355 intent if directory-list pagination is still desired after the move from unified `view` to split `read_file` / `list_files` tools.
- Direct LSP language-ID tests for `.ts`/`.tsx`/`.js`/`.jsx` so future mapping changes cannot regress to raw file extensions.

## Known risks / regressions

- Harness v1 risk: permission state, visible tools, prompt guidance, and runtime tools can drift.
- Extra tools intentionally cannot overwrite built-ins; future merge-order changes could reopen tool-shadowing bugs.
- Function-form `extraTools` can change availability per request context, so prompt guidance, denied filtering, and runtime tool maps must be checked against the same request.
- Denied non-workspace tools are filtered in `createDynamicTools()` and omitted from prompt guidance; workspace tool visibility must be verified separately.
- Task-state Slack regression is adjacent because task tools also need rendered/prompt/runtime state sync.
- Task tools are core built-ins and always-allowed; MC prompt/runtime/TUI restrictions must stay aligned after future core changes.
- LSP-backed tools can break at package startup if ESM-only subpath imports are not built/imported exactly as Node expects.
- Tool schemas can be routed through the wrong Zod converter when source and global installs resolve different Zod versions.
- Token limits now live in both core workspace helpers and MC-owned web-tool wrappers; future moves can silently uncap one path if tests only cover the other.
- Runtime web-search availability and prompt guidance can drift; current prompt guidance explicitly accounts for Tavily and Anthropic, while #13609 also exposes OpenAI native `web_search`.
- The old `view_range` directory pagination no longer exists literally in current source; current `list_files` has no offset/limit pagination, so large-directory ergonomics rely on tree options and token caps unless future work reintroduces pagination.
- Hidden-file behavior moved from shell `find` globs in the old MC-owned tools to core filesystem filtering; future filesystem providers must keep dotfile semantics consistent.
- LSP support has both legacy MC-local and current core workspace mapping files; stale imports or tests can verify the wrong path if the active tool owner changes again.
- Path semantics can drift between shell commands and edit tools; absolute-looking project paths such as `/src/app.ts` need helpful correction without treating real system paths as workspace-relative.
- Approval resume can silently fail if snapshot persistence sees unserializable request-context values or if standalone agents are not attached to a Mastra instance with storage.
- `safeStringify()` protects circular ancestors but still stringifies arbitrary object payloads for display; callers must keep token/output caps separate from JSON safety.
- ReDoS regression tests use generous timing budgets; they prove known pathological cases terminate quickly in CI but should not become the only guard for reviewing new renderer/parser regexes.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
