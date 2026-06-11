# Workspace-backed coding tools

## Origin PR / commit

- PR: [#13437](https://github.com/mastra-ai/mastra/pull/13437) — switched Mastra Code from MC-local file/edit/shell tools to core Workspace tools with TUI streaming support.
- Later changes: [#13526](https://github.com/mastra-ai/mastra/pull/13526) — aligned edit tool path resolution with project-root command semantics; [#13609](https://github.com/mastra-ai/mastra/pull/13609) — added OpenAI native web-search fallback in the remaining MC dynamic tool map; [#13687](https://github.com/mastra-ai/mastra/pull/13687) — added core Workspace `name` remapping so the exposed tool dictionary and tool IDs use Mastra Code's stable names; [#13693](https://github.com/mastra-ai/mastra/pull/13693) — lets `createMastraCode({ workspace })` provide a custom workspace instead of the default dynamic local workspace; [#13700](https://github.com/mastra-ai/mastra/pull/13700) — forwards request context and skill/sandbox paths into subagent tool runs; [#13724](https://github.com/mastra-ai/mastra/pull/13724) — adds `.gitignore` filtering, lowers `find_files` default depth to 2, and updates tool guidance; [#13753](https://github.com/mastra-ai/mastra/pull/13753) — lets approved `request_access` paths update the active `LocalFilesystem` immediately for same-turn follow-up tools; [#13695](https://github.com/mastra-ai/mastra/pull/13695) — fixes OpenAI strict-mode schema preparation for workspace tool schemas and agent-network structured output; [#13940](https://github.com/mastra-ai/mastra/pull/13940) — makes subagents inherit the parent `Workspace` and filters workspace tools with `allowedWorkspaceTools` instead of duplicating MC-local tool definitions; [#14565](https://github.com/mastra-ai/mastra/pull/14565) — adds the `lsp_inspect` Workspace tool, Mastra Code tool-name remap/guidance/permissions, and a dedicated TUI renderer; [#14961](https://github.com/mastra-ai/mastra/pull/14961) — reinforces prompt-level recovery from external-path denial by instructing the agent to call `request_access`; [#15151](https://github.com/mastra-ai/mastra/pull/15151) — adds Agent Skills spec directories to workspace skill paths and inherited allowed paths; [#15228](https://github.com/mastra-ai/mastra/pull/15228) — makes symlinked skill paths resolve through canonical filesystem identity so workspace skill tools do not expose duplicate aliases; [#15566](https://github.com/mastra-ai/mastra/pull/15566) — replaces regex-based workspace/skill path parsing with split/procedural normalization in security-sensitive routing paths; [#16094](https://github.com/mastra-ai/mastra/pull/16094) — adds `os.tmpdir()` and `/tmp` as default allowed workspace paths so the agent can use temp scratch space without a `request_access` round-trip; [#16691](https://github.com/mastra-ai/mastra/pull/16691) — makes Mastra Code sandbox commands inherit the parent `process.env` before applying terminal/CI overrides while tracing continues to redact env-shaped fields.

## User-visible behavior

- What the user can do: use standard coding tools (`view`, `search_content`, `find_files`, `write_file`, `string_replace_lsp`, `ast_smart_edit`, `execute_command`, process tools, `lsp_inspect`) through the core Workspace abstraction; `find_files` and `search_content` respect workspace `.gitignore` by default; embedders can pass a custom workspace into `createMastraCode()`.
- Success looks like: workspace tools obey project-root containment, default temp scratch paths (`os.tmpdir()` and `/tmp`), allowed external paths, plan-mode write-tool disabling, LSP hover/diagnostics/definition/implementation lookup, write locks, read-before-write policy, TUI streaming/rendering, explicit workspace overrides, prompt-directed same-turn access approvals via `request_access`, and subagent inheritance of the parent Workspace plus approved skill/sandbox paths.
- Must preserve: user-facing Mastra Code tool names stay stable even though runtime implementations come from `@mastra/core/workspace`, old `mastra_workspace_*` IDs must not remain callable after remapping, the default local workspace remains the fallback when no override is supplied, and subagents must not lose parent-approved filesystem access.

## Entry points / commands

- Commands / shortcuts / flags: agent tool calls; `/permissions` and permission policy still affect tool calls.
- Automatic triggers: `createMastraCode()` supplies `config.workspace ?? getDynamicWorkspace`; Harness resolves/caches the workspace in request context.

## TUI states

- Idle: no workspace tool state is visible until the agent calls a tool.
- Active / modal / error: shell output and tool arguments/results stream into `ToolExecutionComponentEnhanced`; LSP diagnostics render below edit/tool result boxes; approvals still use the Harness permission path.

## Headless / non-TUI behavior

- Supported: core Harness/Workspace tools work outside the TUI when a workspace is configured.
- Not supported / unknown: rich TUI-only rendering such as tree summaries, quiet previews, OSC file links, and diagnostic boxes has no headless equivalent beyond raw tool output.

## Streaming / loading / interrupted states

- Streaming / loading: workspace tool args and shell output stream through Harness tool events and TUI pending tool components.
- Abort / retry / resume: local sandbox process state is held by the reused workspace/ProcessManager; completed output is history, but live process handles are not reconstructed from history.

## Streaming vs loaded-from-history behavior

- While actively streaming: live workspace tools can update partial args, shell output, diagnostics, and final result.
- After reload / history reconstruction: TUI reconstructs completed tool components from persisted tool-call/tool-result events; live shell/process streams are not replayed.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Workspace instance | `createMastraCode({ workspace })` override or default `getDynamicWorkspace` + Core Harness resolver/cache | Parent agent runtime, subagent runtime, workspace tools, skills |
| Workspace ID | Custom workspace ID or `mastra-code-workspace-${projectPath}` for the default dynamic workspace | Mastra workspace registry reuse |
| Filesystem root | `LocalFilesystem.basePath = projectPath` | read/list/search/edit/write tools |
| Extra allowed paths | skill paths (Mastra Code, Claude, and Agent Skills spec dirs) + temp dirs + `sandboxAllowedPaths`; symlinked allowed roots compare canonical targets; `request_access` also calls active `LocalFilesystem.setAllowedPaths()` on approval; base prompt tells agents to use this tool after external-path denial | filesystem containment/access requests, same-turn file tools, subagent workspace tools |
| Sandbox process env | `getDynamicWorkspace()` / `LocalSandbox` via `buildSandboxEnv()` inheriting parent `process.env` plus FORCE_COLOR/CI/NONINTERACTIVE overrides; workspace trace sanitization redacts env-shaped payloads | `execute_command`, process manager, workspace action traces |
| Tool name mapping | Core `WorkspaceToolsConfig.name` + MC `TOOL_NAME_OVERRIDES` | model-visible tool dictionary keys, tool IDs, permissions, TUI components |
| Gitignore filtering | Core `loadGitignore()` + `respectGitignore` / explicit ignored-target bypass | `find_files`, `search_content`, prompt guidance |
| Tool schema compatibility | Core agent/stream schema compat | OpenAI strict-mode workspace tool calls |
| Plan-mode write disable | `getDynamicWorkspace()` tools config | Plan mode tool visibility |
| LSP config/query state | `settings.json` lsp + detected package runner + core `LSPManager`/`LSPClient` | `lsp_inspect`, edit diagnostics, TUI result renderer |

## Key files

- `mastracode/src/index.ts` — public `MastraCodeConfig.workspace` override and fallback to `getDynamicWorkspace` for both Harness generations.
- `mastracode/src/agents/workspace.ts` — dynamic workspace construction, skill/default-temp/sandbox allowed path assembly, parent environment inheritance for sandbox commands, plan-mode write-tool disabling, LSP config, sandbox env.
- `mastracode/src/tools/utils.ts` — allowed-path extraction for tool contexts, combining computed skill paths and sandbox-approved paths.
- `mastracode/src/tools/request-sandbox-access.ts` — `request_access` approval flow, tilde expansion, Harness state update, and same-turn `LocalFilesystem.setAllowedPaths()` call.
- `mastracode/src/agents/prompts/base.ts` — File Access & Sandbox prompt guidance that tells the agent to call `request_access` instead of asking the user to run `/sandbox`.
- `mastracode/src/agents/tools.ts` — MC dynamic tool map after file/edit/shell tools moved to Workspace.
- `mastracode/src/tool-names.ts` — stable Mastra Code tool-name overrides for core workspace tools.
- `packages/core/src/harness/harness.ts` — workspace resolution/cache and request-context wiring.
- `packages/core/src/harness/tools.ts` — passes the parent workspace into non-forked subagents and filters inherited workspace tools with `allowedWorkspaceTools`.
- `packages/core/src/workspace/tools/tools.ts` and `types.ts` — core workspace tool factory and `WorkspaceToolConfig.name` remapping support.
- `packages/core/src/workspace/tools/*` — core read/list/search/edit/write/LSP/shell/process tool implementations.
- `packages/core/src/workspace/skills/*` and `packages/core/src/workspace/filesystem/local-filesystem.ts` — skill source canonical path resolution, procedural versioned path normalization, split-based path parsing, and symlink-aware allowed-root containment.
- `packages/core/src/workspace/tools/lsp-inspect.ts` — `lsp_inspect` input marker parsing, hover/diagnostics/definition/implementation queries, path compression, and cleanup.
- `packages/core/src/workspace/lsp/client.ts`, `manager.ts` — LSP dependency loading, per-file/query preparation, diagnostics waiting, and request helpers.
- `packages/core/src/workspace/gitignore.ts` — `.gitignore` loader used by list/search tree walkers.
- `packages/core/src/stream/aisdk/v5/execute.ts` and `packages/schema-compat/src/zod-to-json.ts` — OpenAI strict-mode schema preparation for workspace tool schemas.
- `mastracode/src/tui/components/tool-execution-enhanced.ts` — TUI summaries for workspace tool output, `lsp_inspect` hover/diagnostic/definition rendering, tree summaries, quiet previews.

## Dependencies / related features

- [Coding tools and approval permissions](./coding-tools-permissions.md) — permissions apply to workspace-backed tools.
- [OpenAI strict schema compatibility](../models/openai-strict-schema-compat.md) — workspace tools rely on provider-compatible schemas for OpenAI strict mode.
- [Streaming tool arguments](./streaming-tool-arguments.md) — live tool-call chunks drive workspace tool rendering.
- [Skills command and workspace resolution](../integrations/skills-command.md) — workspace owns skill paths and skill tools.
- [Quiet mode](../tui/quiet-mode.md) — quiet rendering compacts workspace tool calls.

## Existing tests

- `packages/core/src/workspace/tools/__tests__/tool-creation.test.ts` — workspace tool availability plus remapped exposed names/IDs, duplicate-name failures, sandbox tool remapping.
- `mastracode/src/tools/__tests__/request-sandbox-access.test.ts` — approved access paths update Harness state and the current workspace filesystem immediately.
- `packages/core/src/workspace/tools/__tests__/*.test.ts` — read/list/search/edit/write/LSP/execute/process tool behavior, `.gitignore` filtering, read tracking, write locks, output helpers.
- `packages/core/src/workspace/tools/__tests__/lsp-inspect.test.ts` — marker validation, no-server errors, hover/diagnostics/definition/implementation formatting, absolute-path handling, and cleanup.
- `packages/core/src/harness/workspace-resolution.test.ts` — static/dynamic workspace resolution and caching.
- `packages/core/src/harness/subagent-workspace-integration.test.ts` — real subagent workspace-tool execution and allowlist filtering.
- `packages/core/src/harness/subagent-tool.test.ts` — subagent request-context forwarding, parent workspace propagation, and workspace allowlist filtering.
- `mastracode/src/agents/__tests__/workspace-env.test.ts` — parent env variables pass into workspace subprocesses.
- `mastracode/src/agents/__tests__/build-skill-paths.test.ts` and `workspace-skill-activation.test.ts` — dynamic workspace skill paths. No direct current test asserts `DEFAULT_ALLOWED_PATHS` temp-directory inclusion.
- `packages/core/src/workspace/skills/workspace-skills.test.ts`, `skill-versioning.test.ts`, `workspace.test.ts`, `tools.test.ts`, and `packages/core/src/workspace/filesystem/local-filesystem.test.ts` — symlink/canonical skill alias resolution, versioned skill-source path normalization, and allowed-root containment.
- `mastracode/src/tools/__tests__/get-allowed-paths.test.ts` — skill/sandbox path merging for subagent tool contexts.
- `packages/core/src/workspace/tools/__tests__/tracing.test.ts` — workspace action trace sanitization redacts env-shaped objects and secret-pattern keys while preserving non-cyclic shared references.
- `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts` — TUI formatting for workspace tool output including quiet view previews, diagnostics, tree summaries, and edge cases.
- `mastracode/scripts/mc-e2e/scenarios/workspace-tool-names.ts` — partial TUI e2e: submits a real PTY prompt through OpenAI AIMock and verifies the provider-visible tool dictionary exposes stable Mastra Code aliases (`view`, `find_files`, `search_content`, `execute_command`, `lsp_inspect`) without leaking old `mastra_workspace_*` IDs. Break validations removed `view`, `lsp_inspect`, and `execute_command` overrides and the scenario failed request verification each time.
- `mastracode/scripts/mc-e2e/scenarios/workspace-tool-output-rendering.ts` — partial TUI e2e: writes a deterministic TypeScript file, drives AIMock `execute_command` and `lsp_inspect` tool calls through the real PTY TUI, and verifies shell stdout, `$` footer label, LSP file/line/match footer, and final assistant follow-up render. Break validations disabled shell streaming/final output, stripped LSP footer args, and changed the shell footer label; the scenario failed each time and all breaks were reverted.
- `mastracode/scripts/mc-e2e/scenarios/workspace-plan-mode-tools.ts` — TUI e2e: captures provider-visible tool dictionaries before and after `/mode plan`, verifies build mode exposes workspace write tools (`write_file`, `string_replace_lsp`, `ast_smart_edit`), and verifies plan mode removes those write/edit tools while preserving read/search/LSP tools (`view`, `find_files`, `search_content`, `lsp_inspect`). Break validations disabled plan-mode filtering, removed only `write_file` filtering, and accidentally disabled `view`; the scenario failed each time and all breaks were reverted.

## Missing tests

- Covered by `mastracode/scripts/mc-e2e/scenarios/workspace-plan-mode-tools.ts`: plan-mode integration proves workspace write/edit/AST tools are hidden while read/search/LSP tools remain available.
- Covered by `mastracode/scripts/mc-e2e/scenarios/tool-history-reload.ts`: persisted `view` tool call/result reconstructs after `/threads` reload with representative workspace read output.
- Still missing: loaded-history breadth for list/edit outputs (shell live output is covered by `workspace-tool-output-rendering`; persisted shell history remains untested).
- Direct test that `getDynamicWorkspace()` reuses the registered workspace while updating allowed paths/tool config across mode changes, including default `os.tmpdir()`/`/tmp` inclusion and de-duplication.
- Covered by `mastracode/src/__tests__/index.test.ts`: config-level startup test proves `createMastraCode({ workspace })` passes a custom workspace through to Harness and keeps the default workspace factory lazy when no override is supplied.
- Mastra Code integration test proving built-in explore/plan/execute subagents get workspace tools from the parent workspace after tool-name remapping and disabled-tool filtering.
- Covered by `mastracode/scripts/mc-e2e/scenarios/workspace-tool-output-rendering.ts`: end-to-end `lsp_inspect` smoke test against a real TypeScript file proving LSP result/fallback footer renders through the Mastra Code TUI, not only mocked component tests.

## Known risks / regressions

- Tool names are stable aliases over core Workspace tool IDs; drift between `TOOL_NAME_OVERRIDES`, prompt guidance, permissions, subagent allowlists, and TUI special cases can hide or mis-render tools.
- `lsp_inspect` relies on optional language-server binaries/deps and exact `<<<` marker placement; fallback errors must stay actionable when LSP is unavailable.
- Workspace caching preserves process-manager state, but stale allowed paths/tool configs must be refreshed when thread state or mode changes.
- Symlink/canonical path handling spans LocalFilesystem containment, skill sources, workspace skill catalog, and prompt/tool activation; partial updates can reintroduce duplicate skill aliases or over-broad allowed roots.
- Workspace/skill path parsing should stay split-based or procedural; unbounded normalization regexes can reintroduce polynomial backtracking risks on attacker-shaped paths.
- TUI rich rendering can mask raw output regressions if only component snapshots are checked.
- Plan mode disables write/edit tools through workspace config, not through the old MC dynamic tool map.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
