# Workspace-backed coding tools

## Origin PR / commit

- PR: [#13437](https://github.com/mastra-ai/mastra/pull/13437) — switched Mastra Code from MC-local file/edit/shell tools to core Workspace tools with TUI streaming support.
- Later changes: [#13526](https://github.com/mastra-ai/mastra/pull/13526) — aligned edit tool path resolution with project-root command semantics; [#13609](https://github.com/mastra-ai/mastra/pull/13609) — added OpenAI native web-search fallback in the remaining MC dynamic tool map; [#13687](https://github.com/mastra-ai/mastra/pull/13687) — added core Workspace `name` remapping so the exposed tool dictionary and tool IDs use Mastra Code's stable names; [#13693](https://github.com/mastra-ai/mastra/pull/13693) — lets `createMastraCode({ workspace })` provide a custom workspace instead of the default dynamic local workspace.

## User-visible behavior

- What the user can do: use standard coding tools (`view`, `search_content`, `find_files`, `write_file`, `string_replace_lsp`, `ast_smart_edit`, `execute_command`, process tools, LSP inspect) through the core Workspace abstraction; embedders can pass a custom workspace into `createMastraCode()`.
- Success looks like: workspace tools obey project-root containment, allowed external paths, plan-mode write-tool disabling, LSP diagnostics, write locks, read-before-write policy, TUI streaming/rendering, and explicit workspace overrides.
- Must preserve: user-facing Mastra Code tool names stay stable even though runtime implementations come from `@mastra/core/workspace`, old `mastra_workspace_*` IDs must not remain callable after remapping, and the default local workspace remains the fallback when no override is supplied.

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
| Workspace instance | `createMastraCode({ workspace })` override or default `getDynamicWorkspace` + Core Harness resolver/cache | Agent runtime, workspace tools, skills |
| Workspace ID | Custom workspace ID or `mastra-code-workspace-${projectPath}` for the default dynamic workspace | Mastra workspace registry reuse |
| Filesystem root | `LocalFilesystem.basePath = projectPath` | read/list/search/edit/write tools |
| Extra allowed paths | skill paths + temp dirs + `sandboxAllowedPaths` | filesystem containment/access requests |
| Sandbox process env | `getDynamicWorkspace()` / `LocalSandbox` | `execute_command`, process manager |
| Tool name mapping | Core `WorkspaceToolsConfig.name` + MC `TOOL_NAME_OVERRIDES` | model-visible tool dictionary keys, tool IDs, permissions, TUI components |
| Plan-mode write disable | `getDynamicWorkspace()` tools config | Plan mode tool visibility |
| LSP config | `settings.json` lsp + detected package runner + MC module search path | `lsp_inspect`, edit diagnostics |

## Key files

- `mastracode/src/index.ts` — public `MastraCodeConfig.workspace` override and fallback to `getDynamicWorkspace` for both Harness generations.
- `mastracode/src/agents/workspace.ts` — dynamic workspace construction, skill/allowed path assembly, plan-mode write-tool disabling, LSP config, sandbox env.
- `mastracode/src/agents/tools.ts` — MC dynamic tool map after file/edit/shell tools moved to Workspace.
- `mastracode/src/tool-names.ts` — stable Mastra Code tool-name overrides for core workspace tools.
- `packages/core/src/harness/harness.ts` — workspace resolution/cache and request-context wiring.
- `packages/core/src/workspace/tools/tools.ts` and `types.ts` — core workspace tool factory and `WorkspaceToolConfig.name` remapping support.
- `packages/core/src/workspace/tools/*` — core read/list/search/edit/write/LSP/shell/process tool implementations.
- `mastracode/src/tui/components/tool-execution-enhanced.ts` — TUI summaries for workspace tool output, LSP diagnostics, tree summaries, quiet previews.

## Dependencies / related features

- [Coding tools and approval permissions](./coding-tools-permissions.md) — permissions apply to workspace-backed tools.
- [Streaming tool arguments](./streaming-tool-arguments.md) — live tool-call chunks drive workspace tool rendering.
- [Skills command and workspace resolution](../integrations/skills-command.md) — workspace owns skill paths and skill tools.
- [Quiet mode](../tui/quiet-mode.md) — quiet rendering compacts workspace tool calls.

## Existing tests

- `packages/core/src/workspace/tools/__tests__/tool-creation.test.ts` — workspace tool availability plus remapped exposed names/IDs, duplicate-name failures, sandbox tool remapping.
- `packages/core/src/workspace/tools/__tests__/*.test.ts` — read/list/search/edit/write/LSP/execute/process tool behavior, read tracking, write locks, output helpers.
- `packages/core/src/harness/workspace-resolution.test.ts` — static/dynamic workspace resolution and caching.
- `packages/core/src/harness/subagent-workspace-integration.test.ts` — subagent workspace-tool visibility/allowlists.
- `mastracode/src/agents/__tests__/workspace-env.test.ts` — parent env variables pass into workspace subprocesses.
- `mastracode/src/agents/__tests__/build-skill-paths.test.ts` and `workspace-skill-activation.test.ts` — dynamic workspace skill paths.
- `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts` — TUI formatting for workspace tool output including quiet view previews, diagnostics, tree summaries, and edge cases.

## Missing tests

- End-to-end Mastra Code run proving the model sees renamed workspace tools and cannot call old `mastra_workspace_*` names by fallback ID.
- Plan-mode integration test proving workspace write/edit/AST tools are hidden or disabled while read/search tools remain available.
- Loaded-history test proving workspace tool results render identically after reload for representative read/list/edit/shell outputs.
- Direct test that `getDynamicWorkspace()` reuses the registered workspace while updating allowed paths/tool config across mode changes.
- Mastra Code config-level test proving `createMastraCode({ workspace })` passes the custom workspace through to both Harness v1 and HarnessCompat instead of the default factory.

## Known risks / regressions

- Tool names are stable aliases over core Workspace tool IDs; drift between `TOOL_NAME_OVERRIDES`, prompt guidance, permissions, and TUI special cases can hide or mis-render tools.
- Workspace caching preserves process-manager state, but stale allowed paths/tool configs must be refreshed when thread state or mode changes.
- TUI rich rendering can mask raw output regressions if only component snapshots are checked.
- Plan mode disables write/edit tools through workspace config, not through the old MC dynamic tool map.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
