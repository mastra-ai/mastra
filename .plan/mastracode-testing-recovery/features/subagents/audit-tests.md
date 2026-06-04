# Audit-tests subagent

## Origin PR / commit

- PR: [#13331](https://github.com/mastra-ai/mastra/pull/13331) — added a read-only `audit-tests` subagent for test quality review.
- Later changes: [#13339](https://github.com/mastra-ai/mastra/pull/13339) added the single-use exception to prompt guidance; current source still has registration/help-text gaps — see Known risks.

## User-visible behavior

- Intended: parent agents can call `subagent({ agentType: 'audit-tests', task: ... })` to get a read-only audit of test quality.
- Current verified behavior: `mastracode/src/agents/subagents/audit-tests.ts` exists, but `mastracode/src/index.ts` only registers `explore`, `plan`, and `execute` as default subagents.
- Must preserve: read-only access, repo-specific test convention discovery, line-referenced findings, and actionable recommendations.

## Entry points / commands

- Tool call: `subagent({ agentType: 'audit-tests', task })`.
- Prompt guidance: base instructions allow `audit-tests` as the one subagent exception that can be used alone.
- No slash command found.

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

- No audit-tests-specific test found.
- `mastracode/src/agents/subagents/execute.test.ts` covers a different subagent.

## Missing tests

- Test that `audit-tests` is registered in default subagents and accepted by the `subagent` tool.
- Test that it only exposes read tools (`view`, `search_content`, `find_files`).
- Prompt/test snapshot that the single-subagent exception is consistent with actual availability.

## Known risks / regressions

- Current registration gap: the definition exists but is not imported into `createMastraCode()` defaults.
- Prompt says `audit-tests` can be used alone, which may mislead the agent if the runtime rejects the agent type.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
