# Subagent delegation

## Origin PR / commit

- PR: [#13227](https://github.com/mastra-ai/mastra/pull/13227) — extracted built-in Explore, Plan, and Execute subagents plus dynamic workspace support.
- Later changes: [#13331](https://github.com/mastra-ai/mastra/pull/13331) added an intended `audit-tests` subagent; [#13339](https://github.com/mastra-ai/mastra/pull/13339) added parallel-only subagent guidance and an audit-tests exception; [#13556](https://github.com/mastra-ai/mastra/pull/13556) made completed subagent output quiet-mode-sensitive; [#13700](https://github.com/mastra-ai/mastra/pull/13700) forwarded request context and skill/sandbox paths so subagents inherit the parent's filesystem access; current registration/help-text gaps are tracked separately.

## User-visible behavior

- What the user can do: delegate focused work to `explore`, `plan`, or `execute` subagents.
- Success looks like: read-only subagents cannot edit; execute can make focused changes; parent chat shows subagent progress/results; subagents can read approved external paths and skill directories that the parent workspace can access.
- Must preserve: subagent model selection, tool boundaries, parallel-only usage guidance, audit-tests exception, request-context inheritance without parent thread/resource leakage, and loaded-history render of subagent activity.

## Entry points / commands

- Commands / shortcuts / flags: `subagent` tool call; `/subagents` chooses per-type model defaults.
- Automatic triggers: harness subagent definitions registered during `createMastraCode()`.

## TUI states

- Idle: `/subagents` opens type/scope/model selection.
- Active / modal / error: `SubagentExecutionComponent` shows running tools, completion, failure, collapse/expand.

## Headless / non-TUI behavior

- Supported: subagent tool can run through the same harness path when the agent calls it.
- Not supported / unknown: no `/subagents` modal; model defaults must come from settings/session state.

## Streaming / loading / interrupted states

- Streaming / loading: subagent activity can render as nested tool/progress state.
- Abort / retry / resume: parent run owns cancellation; non-forked subagents get a copied request context with parent thread/resource stripped, while forked subagents retarget inherited tools to the cloned thread/resource.

## Streaming vs loaded-from-history behavior

- While actively streaming: TUI tracks pending subagent/tool activity.
- After reload / history reconstruction: `renderExistingMessages()` can rebuild persisted subagent tool output, including fork metadata cases.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Subagent definitions | Harness config from `createMastraCode()` | `subagent` tool, `/subagents` |
| Read/write boundaries | Subagent `allowedWorkspaceTools` / instructions | Runtime tool availability |
| Subagent model override | Harness state + settings | `/subagents`, runtime context |
| Request context | copied parent `RequestContext`; thread/resource stripped for non-forked runs, retargeted for forked runs | subagent `Agent.stream()` tools |
| Filesystem access | workspace skill paths + sandbox-approved paths from harness state | subagent workspace/file tools |
| Rendered progress | Harness events/history + `TUIState.quietMode` | TUI subagent component |
| Usage guidance | Base prompt + tool guidance prompt section | Parent agent behavior |

## Key files

- `mastracode/src/agents/subagents/explore.ts` — read-only Explore subagent.
- `mastracode/src/agents/subagents/plan.ts` — read-only Plan subagent.
- `mastracode/src/agents/subagents/execute.ts` — write-capable Execute subagent.
- `packages/core/src/harness/tools.ts` — `createSubagentTool()` request-context forwarding, forked/non-forked thread/resource handling, workspace allowlist filtering, and event streaming.
- `mastracode/src/agents/workspace.ts` — per-request workspace, skill paths, sandbox paths, and plan-mode write-tool disablement.
- `mastracode/src/tools/utils.ts` — `getAllowedPathsFromContext()` merges computed skill paths with sandbox-approved paths.
- `mastracode/src/tui/commands/subagents.ts` — `/subagents` model selection.
- `mastracode/src/tui/components/subagent-execution.ts` — TUI render component.
- `mastracode/src/agents/prompts/base.ts` — top-level subagent usage rule.
- `mastracode/src/agents/prompts/tool-guidance.ts` — tool-specific subagent guidance.

## Dependencies / related features

- [Audit-tests subagent](./audit-tests.md) — intended read-only test-audit subagent with current registration risk.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — subagents depend on workspace tool boundaries.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — subagent model overrides use the model catalog/auth path.
- [Interactive TUI chat](../tui/interactive-chat.md) — subagent progress renders inside chat.
- [Quiet mode](../tui/quiet-mode.md) — completed subagent output is quiet-mode-sensitive.

## Existing tests

- `mastracode/src/agents/subagents/execute.test.ts` — execute subagent does not expose parent task tools.
- `mastracode/src/tui/commands/__tests__/subagents.test.ts` — built-in/custom subagent type picker.
- `mastracode/src/tui/components/__tests__/subagent-execution.test.ts` — running/completed/error/fork rendering and completion collapse/expand options.
- `mastracode/src/tui/__tests__/render-messages.test.ts` — persisted subagent rendering cases.
- `mastracode/src/agents/prompts/index.test.ts` / tool-guidance tests — partial prompt/guidance coverage.
- `packages/core/src/harness/subagent-tool.test.ts` — request-context copy/retargeting, tracing-context forwarding, workspace propagation, and `allowedWorkspaceTools` filtering.
- `mastracode/src/tools/__tests__/get-allowed-paths.test.ts` — skill-path plus sandbox-path merging for subagent/file-tool access.

## Missing tests

- End-to-end parent run spawning each built-in subagent with expected tool allowlist and inherited sandbox access.
- Abort propagation from parent run to active subagent.
- `/subagents` thread/global model override persists across restart and thread switch.
- Prompt test that subagent guidance consistently includes the audit-tests single-use exception everywhere it is shown.

## Known risks / regressions

- Tool boundaries are split across instructions and runtime allowlists; both need verification.
- Request-context forwarding must avoid leaking the parent thread/resource into non-forked subagents while still preserving sandbox and skill-path access.
- Harness v1 migration risk: forked subagent sessions can leak into thread lists unless filtered.
- Loaded-history subagent render depends on persisted tool metadata being complete.
- Quiet-mode wording and current source can drift; current code passes `expandOnComplete: state.quietMode` rather than collapsing completed subagents.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
