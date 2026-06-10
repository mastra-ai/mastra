# Subagent delegation

## Origin PR / commit

- PR: [#13227](https://github.com/mastra-ai/mastra/pull/13227) — extracted built-in Explore, Plan, and Execute subagents plus dynamic workspace support.
- Later changes: [#13331](https://github.com/mastra-ai/mastra/pull/13331) added an intended `audit-tests` subagent; [#13339](https://github.com/mastra-ai/mastra/pull/13339) added parallel-only subagent guidance and an audit-tests exception; [#13556](https://github.com/mastra-ai/mastra/pull/13556) made completed subagent output quiet-mode-sensitive; [#13700](https://github.com/mastra-ai/mastra/pull/13700) forwarded request context and skill/sandbox paths so subagents inherit the parent's filesystem access; [#13940](https://github.com/mastra-ai/mastra/pull/13940) moved subagents onto the parent Agent workspace instead of MC-local duplicate tool definitions; [#14804](https://github.com/mastra-ai/mastra/pull/14804) fixes `/subagents` so the picker reflects configured `createMastraCode({ subagents })` definitions and falls back to built-ins only when config is absent/empty; [#15088](https://github.com/mastra-ai/mastra/pull/15088) preserves configured subagent choices and seeds global subagent model defaults from both `default` and `_default` settings keys; [#15695](https://github.com/mastra-ai/mastra/pull/15695) adds forked subagents that clone the parent thread, reuse the parent agent/tool schema prefix, inherit parent toolsets, and hide forked threads from normal thread listings; [#17070](https://github.com/mastra-ai/mastra/pull/17070) fixes legacy subagent results so old generate paths return text/usage without leaking subagent thread/resource/tool-result fields.

## User-visible behavior

- What the user can do: delegate focused work to built-in or configured subagents, choose per-subagent model defaults from `/subagents`, and run forked subagents that inherit the parent conversation context when requested/configured.
- Success looks like: read-only subagents cannot edit; execute can make focused changes; parent chat shows subagent progress/results; configured subagents appear in the `/subagents` picker when supplied; global default subagent model settings seed runtime state; legacy subagent generate results stay compatible with old text/usage callers; non-forked subagents use the same Workspace instance and approved filesystem paths as the parent, while forked subagents run on a cloned parent thread with parent prompt/tool cache stability.
- Must preserve: subagent model selection for configured and built-in types, `default`/`_default` global model default handling, workspace inheritance, tool boundaries, parallel-only usage guidance, audit-tests exception, request-context inheritance without parent thread/resource leakage, and loaded-history render of subagent activity.

## Entry points / commands

- Commands / shortcuts / flags: `subagent` tool call; `/subagents` chooses per-type model defaults and lists configured subagent names/descriptions when present.
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
| Subagent definitions | Harness config from `createMastraCode()`; `/subagents` maps configured `{ id, name, description }` definitions and falls back to built-ins only for missing/empty config | `subagent` tool, `/subagents` |
| Read/write boundaries | Subagent `allowedWorkspaceTools` / instructions | Runtime tool availability |
| Subagent model override | Harness state + settings; startup seeds `subagentModelId` from global `default` or `_default` keys and `subagentModelId_<id>` from configured IDs | `/subagents`, runtime context |
| Request context | copied parent `RequestContext`; thread/resource stripped for non-forked runs, retargeted for forked runs | subagent `Agent.stream()` tools |
| Forked thread metadata | `cloneThreadForFork()` marks cloned threads with `forkedSubagent: true` and `parentThreadId`; list APIs hide these threads unless explicitly included | forked subagent memory/tool context, thread picker/listing |
| Forked/legacy result shape | parent harness toolsets copied with `subagent` and task tools patched to runtime no-ops while preserving prompt-shaping fields; legacy generate results return only text plus optional usage | forked subagent streams, prompt-cache prefix stability, old caller compatibility |
| Filesystem access | parent `Workspace` plus skill paths + sandbox-approved paths from harness state | subagent workspace/file tools |
| Rendered progress | Harness events/history + `TUIState.quietMode` | TUI subagent component |
| Usage guidance | Base prompt + tool guidance prompt section | Parent agent behavior |

## Key files

- `mastracode/src/agents/subagents/explore.ts` — read-only Explore subagent.
- `mastracode/src/agents/subagents/plan.ts` — read-only Plan subagent.
- `mastracode/src/agents/subagents/execute.ts` — write-capable Execute subagent.
- `packages/core/src/harness/tools.ts` — `createSubagentTool()` request-context forwarding, forked/non-forked thread/resource handling, parent workspace propagation, forked parent-toolset inheritance with patched subagent/task tools, workspace allowlist filtering, and event streaming.
- `packages/core/src/agent/agent.ts` — `SubAgent` interface/static-agent typing and legacy subagent generate result compatibility.
- `mastracode/src/agents/workspace.ts` — per-request workspace, skill paths, sandbox paths, and plan-mode write-tool disablement.
- `mastracode/src/tools/utils.ts` — `getAllowedPathsFromContext()` merges computed skill paths with sandbox-approved paths.
- `mastracode/src/tui/commands/subagents.ts` — `/subagents` model selection and configured-vs-built-in subagent type list.
- `mastracode/src/index.ts` — startup seeding of global and per-subagent model defaults into Harness initial state.
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
- `mastracode/src/tui/commands/__tests__/subagents.test.ts` — built-in fallback, empty-config fallback, and configured subagent type picker.
- `mastracode/src/tui/components/__tests__/subagent-execution.test.ts` — running/completed/error/fork rendering and completion collapse/expand options.
- `mastracode/src/tui/__tests__/render-messages.test.ts` — persisted subagent rendering cases.
- `mastracode/src/agents/prompts/index.test.ts` / tool-guidance tests — partial prompt/guidance coverage.
- `packages/core/src/harness/subagent-tool.test.ts` — request-context copy/retargeting, tracing-context forwarding, parent abort propagation into active subagent streams, forked thread cloning/defaults/errors, parent toolset inheritance with patched `subagent`/task tools, parent workspace propagation, and `allowedWorkspaceTools` filtering.
- `packages/core/src/harness/subagent-workspace-integration.test.ts` — real workspace tool execution from non-forked subagents and allowlist filtering.
- `mastracode/src/tools/__tests__/get-allowed-paths.test.ts` — skill-path plus sandbox-path merging for subagent/file-tool access.

## Missing tests

- Partial e2e coverage exists: `subagent-delegation` drives a real parent TUI chat turn through AIMock `response.toolCalls`, invokes the `subagent` tool with the built-in Explore subagent, renders the delegated task and completed `subagent explore openai/gpt-5.4-mini ✓` footer in the real TUI, and verifies the subagent result is returned.
- End-to-end parent run spawning each built-in subagent with expected tool allowlist and inherited sandbox access; `subagent-delegation` currently covers only Explore and does not prove nested workspace-tool activity.
- `/subagents` thread/global model override persists across restart and thread switch, especially for configured subagent IDs not in the built-in set.
- Prompt test that subagent guidance consistently includes the audit-tests single-use exception everywhere it is shown.

## Known risks / regressions

- Tool boundaries are split across instructions, inherited workspace tools, and runtime allowlists; all three need verification.
- Request-context forwarding must avoid leaking the parent thread/resource into non-forked subagents while still preserving sandbox and skill-path access.
- Harness v1 migration risk: forked subagent sessions can leak into thread lists unless filtered.
- Loaded-history subagent render depends on persisted tool metadata being complete.
- Configured subagent names/descriptions come from Harness config while model overrides are keyed by subagent ID; mismatches can make `/subagents` look right but persist the wrong override.
- Quiet-mode wording and current source can drift; current code passes `expandOnComplete: state.quietMode` rather than collapsing completed subagents.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
