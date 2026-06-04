# GitHub issue reporting command

## Origin PR / commit

- PR: [#13605](https://github.com/mastra-ai/mastra/pull/13605) — added a guided GitHub issue-reporting slash command. The PR title mentions `/fix-issue`, but a later commit in the same PR removed `/fix-issue`; current HEAD only exposes `/report-issue`.

## User-visible behavior

- What the user can do: run `/report-issue [context]` to have the agent gather issue details, search for duplicates, draft an issue, ask for approval, and create/comment through `gh`.
- Success looks like: the agent never creates an issue without user approval, searches existing Mastra Code issues first, and reports the created/commented issue URL back.
- Must preserve: model-selected gate and thread creation before sending the guided slash-command prompt.

## Entry points / commands

- Commands / shortcuts / flags: `/report-issue [initial context]`.
- Automatic triggers: autocomplete and `/help` list the command.

## TUI states

- Idle: command checks for selected model, ensures a thread exists if needed, then sends a slash-command message.
- Active / modal / error: command is a prompt injection workflow; subsequent duplicate search, approval, and `gh` commands happen through the normal agent/tool flow.

## Headless / non-TUI behavior

- Supported: no dedicated headless command path verified.
- Not supported / unknown: TUI slash-command dispatcher owns the current command.

## Streaming / loading / interrupted states

- Streaming / loading: the command sends a normal slash-command message, so follow-up tool calls stream through regular chat/tool renderers.
- Abort / retry / resume: if the issue workflow is interrupted, no separate command state is persisted beyond chat history.

## Streaming vs loaded-from-history behavior

- While actively streaming: generated prompt guides the live agent to ask questions, run `gh issue list` / `gh search issues`, and ask for approval before creation.
- After reload / history reconstruction: prior `/report-issue` prompt appears as conversation history, but the command does not resume an explicit workflow state machine.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Command registration | `command-dispatch.ts`, setup autocomplete, help overlay | Slash command parser, autocomplete, `/help` |
| Issue workflow instructions | `report-issue.ts` prompt string | Agent run after slash-command message |
| Current thread existence | Harness thread state | `handleReportIssueCommand()` |
| GitHub side effects | `gh` CLI commands executed by agent | GitHub issues/comments |

## Key files

- `mastracode/src/tui/commands/report-issue.ts` — model gate, thread creation, guided issue-reporting prompt.
- `mastracode/src/tui/command-dispatch.ts` — routes `/report-issue`.
- `mastracode/src/tui/commands/index.ts` — exports the command handler.
- `mastracode/src/tui/setup.ts` — autocomplete entry.
- `mastracode/src/tui/components/help-overlay.ts` — `/help` command list entry.

## Dependencies / related features

- [Queued follow-ups and slash commands](../chat/queued-followups.md) — uses normal slash-command dispatch/message send behavior.
- [Interactive chat](../tui/interactive-chat.md) — renders the generated issue-reporting flow.
- [Coding tools and approval permissions](../tools/coding-tools-permissions.md) — `gh` commands run through shell/command tooling and approval policy.

## Existing tests

- `mastracode/src/tui/__tests__/command-dispatch.test.ts` mocks `handleReportIssueCommand`, but current assertions do not directly prove `/report-issue` routing.
- `mastracode/src/tui/components/__tests__/help-overlay.test.ts` covers the hardcoded help command list generally.

## Missing tests

- Direct command test for `/report-issue` routing, model-selected gate, pending-thread creation, and `sendSlashCommandMessage()` payload.
- Prompt-content test proving duplicate search, user approval before issue creation/commenting, `mastracode` label, and `mastra-ai/mastra` repo are preserved.
- Regression test that `/fix-issue` remains absent or intentionally reintroduced with a separate implementation.

## Known risks / regressions

- PR title and current command surface disagree; future audits can assume `/fix-issue` exists unless they verify current source.
- The workflow is prompt-driven rather than a state machine, so safety depends on prompt wording and model/tool compliance.
- Help/autocomplete/dispatch are manually maintained and can drift.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
