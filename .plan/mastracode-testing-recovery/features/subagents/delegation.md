# Subagent delegation

## Origin PR / commit

- PR: [#13227](https://github.com/mastra-ai/mastra/pull/13227) — extracted built-in Explore, Plan, and Execute subagents plus dynamic workspace support.
- Later changes: [#13331](https://github.com/mastra-ai/mastra/pull/13331) added an intended `audit-tests` subagent; [#13339](https://github.com/mastra-ai/mastra/pull/13339) added parallel-only subagent guidance and an audit-tests exception; current registration/help-text gaps are tracked separately.

## User-visible behavior

- What the user can do: delegate focused work to `explore`, `plan`, or `execute` subagents.
- Success looks like: read-only subagents cannot edit; execute can make focused changes; parent chat shows subagent progress/results.
- Must preserve: subagent model selection, tool boundaries, parallel-only usage guidance, audit-tests exception, and loaded-history render of subagent activity.

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
- Abort / retry / resume: parent run owns cancellation; exact subagent abort propagation needs verification.

## Streaming vs loaded-from-history behavior

- While actively streaming: TUI tracks pending subagent/tool activity.
- After reload / history reconstruction: `renderExistingMessages()` can rebuild persisted subagent tool output, including fork metadata cases.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Subagent definitions | Harness config from `createMastraCode()` | `subagent` tool, `/subagents` |
| Read/write boundaries | Subagent `allowedWorkspaceTools` / instructions | Runtime tool availability |
| Subagent model override | Harness state + settings | `/subagents`, runtime context |
| Rendered progress | Harness events/history | TUI subagent component |
| Usage guidance | Base prompt + tool guidance prompt section | Parent agent behavior |

## Key files

- `mastracode/src/agents/subagents/explore.ts` — read-only Explore subagent.
- `mastracode/src/agents/subagents/plan.ts` — read-only Plan subagent.
- `mastracode/src/agents/subagents/execute.ts` — write-capable Execute subagent.
- `mastracode/src/agents/workspace.ts` — per-request workspace and plan-mode write-tool disablement.
- `mastracode/src/tui/commands/subagents.ts` — `/subagents` model selection.
- `mastracode/src/tui/components/subagent-execution.ts` — TUI render component.
- `mastracode/src/agents/prompts/base.ts` — top-level subagent usage rule.
- `mastracode/src/agents/prompts/tool-guidance.ts` — tool-specific subagent guidance.

## Dependencies / related features

- [Audit-tests subagent](./audit-tests.md) — intended read-only test-audit subagent with current registration risk.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — subagents depend on workspace tool boundaries.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — subagent model overrides use the model catalog/auth path.
- [Interactive TUI chat](../tui/interactive-chat.md) — subagent progress renders inside chat.

## Existing tests

- `mastracode/src/agents/subagents/execute.test.ts` — execute subagent does not expose parent task tools.
- `mastracode/src/tui/commands/__tests__/subagents.test.ts` — built-in/custom subagent type picker.
- `mastracode/src/tui/components/__tests__/subagent-execution.test.ts` — running/completed/error/fork rendering.
- `mastracode/src/tui/__tests__/render-messages.test.ts` — persisted subagent rendering cases.
- `mastracode/src/agents/prompts/index.test.ts` / tool-guidance tests — partial prompt/guidance coverage.

## Missing tests

- End-to-end parent run spawning each built-in subagent with expected tool allowlist.
- Abort propagation from parent run to active subagent.
- `/subagents` thread/global model override persists across restart and thread switch.
- Prompt test that subagent guidance consistently includes the audit-tests single-use exception everywhere it is shown.

## Known risks / regressions

- Tool boundaries are split across instructions and runtime allowlists; both need verification.
- Harness v1 migration risk: forked subagent sessions can leak into thread lists unless filtered.
- Loaded-history subagent render depends on persisted tool metadata being complete.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
