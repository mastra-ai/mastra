# Audit-tests subagent

## Origin PR / commit

- PR: [#13331](https://github.com/mastra-ai/mastra/pull/13331) — added a read-only `audit-tests` subagent for test quality review.
- Later changes: [#13339](https://github.com/mastra-ai/mastra/pull/13339) added the single-use exception to prompt guidance; current source still has registration/help-text gaps — see Known risks.

## User-visible behavior

- Historical intent: parent agents could call `subagent({ agentType: 'audit-tests', task: ... })` to get a read-only audit of test quality.
- Current verified behavior: `mastracode/src/agents/subagents/audit-tests.ts` exists, and the base prompt still mentions the single-use exception, but `mastracode/src/index.ts` only registers `explore`, `plan`, and `execute` as default subagents.
- Disposition: remove the stale subagent instead of reviving it. If test-audit behavior returns, it should be redesigned as a skill or explicit slash command rather than a built-in default subagent.
- Must preserve in any replacement: read-only access, repo-specific test convention discovery, line-referenced findings, and actionable recommendations.

## Entry points / commands

- Current stale tool shape: `subagent({ agentType: 'audit-tests', task })`, but the default runtime no longer exposes this agent type.
- Current stale prompt guidance: base instructions allow `audit-tests` as the one subagent exception that can be used alone.
- Planned removal: delete the stale subagent definition and prompt exception.
- Future replacement option: a skill for reusable test-audit instructions, or a slash command such as `/audit-tests` that gathers changed files and injects a structured audit prompt.

## TUI states

- Idle: no visible UI until a parent agent calls the subagent tool.
- Active / modal / error: should render through the normal subagent execution component if registered.

## Headless / non-TUI behavior

- Intended to work anywhere the `subagent` tool works.
- Current availability is uncertain because default registration is missing.

## Streaming / loading / interrupted states

- Streaming: should use normal subagent start/tool/end events.
- Interrupted: should behave like other subagents; no audit-tests-specific interrupt handling found.

## Streaming vs loaded-from-history behavior

- Active streaming: live subagent events render while the audit runs.
- Loaded from history: stored `subagent` tool call/result reconstructs via `SubagentExecutionComponent` from message content; no audit-tests-specific history renderer.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Subagent definition | `audit-tests.ts` | Harness subagent config |
| Subagent availability | `createMastraCode()` subagent list | `subagent` tool schema/runtime |
| Report content | subagent instructions | parent agent/user |

## Key files

- `mastracode/src/agents/subagents/audit-tests.ts` — definition and audit instructions.
- `mastracode/src/index.ts` — current default subagent registration.
- `mastracode/src/agents/prompts/base.ts` — usage exception for `audit-tests`.
- `mastracode/src/tui/render-messages.ts` — historical subagent rendering.

## Dependencies / related features

- [Delegation to Explore / Plan / Execute](./delegation.md) — general subagent runtime and model selection.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — read-only tools used by the auditor.

## Existing tests

- `mastracode/src/agents/__tests__/prompts.test.ts` verifies the base prompt no longer advertises an `audit-tests` single-use subagent exception.
- `mastracode/src/agents/subagents/execute.test.ts` covers the remaining Execute subagent read-only/task-tool contract.
- Source-reference guard verified no production `audit-tests`, `auditTestsSubagent`, or `Audit Tests` references remain under `mastracode/src`.

## Removal plan

1. [x] Delete `mastracode/src/agents/subagents/audit-tests.ts`.
2. [x] Remove the stale single-use exception from `mastracode/src/agents/prompts/base.ts`.
3. [x] Add a Mastra Code changeset noting that the unused, unavailable `audit-tests` subagent definition and prompt guidance were removed.
4. [x] Verify with production-source reference guard, focused prompt/subagent tests, build, typecheck, and lint.
5. Do not add replacement behavior in the removal PR. If test-audit behavior is wanted later, design it as a skill or slash command in separate work.

## Missing tests

- No further product tests are needed for the removal; the desired end state is that `audit-tests` is no longer advertised or available.
- If reintroduced as a skill or slash command, add tests for input gathering, read-only behavior, and generated audit prompt content.

## Known risks / regressions

- Removal landed locally: the stale definition is deleted and the prompt no longer says `audit-tests` can be used alone.
- A future replacement should not silently re-add a built-in subagent unless there is a clear user-facing entry point and direct coverage.
- Break validation covered stale prompt reintroduction, stale production source reintroduction, and generic single-use subagent guidance reintroduction.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
