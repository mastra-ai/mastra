# Feature name

## Origin PR / commit

- PR: [#00000](https://github.com/mastra-ai/mastra/pull/00000) — what it introduced.
- Commit: `0000000000` — use when no PR is known.

## User-visible behavior

What the user can do, what success looks like, and what should be preserved.

## Entry points / commands

Slash commands, keyboard shortcuts, CLI flags, tool calls, UI affordances, or automatic triggers.

## TUI states

Idle, active, modal/dialog, footer/status, rendering, selection, error, and recovery states relevant to this feature.

## Headless / non-TUI behavior

How this behaves outside the interactive TUI, including `--prompt`, `--continue`, `--thread`, background flows, or absence of support.

## Streaming / loading / interrupted states

What happens while work is running, loading, streaming, cancelled, aborted, retried, or resumed.

## State ownership

List each important state field and its source of truth. Note persisted storage, thread metadata, session state, TUI projection, prompt context, and tool/runtime access when relevant.

## Key files

- `path/to/file.ts` — why it matters.

## Dependencies / related features

- [Related feature](../area/page.md) — relationship.

## Existing tests

- `path/to/test.ts` — what it proves.

## Missing tests

- Behavior or regression not currently covered.

## Known risks / regressions

- Verified risk, bug, Slack report, or suspected migration hazard. Mark unverified items clearly.

## Verification checklist

- [ ] Code paths checked.
- [ ] Existing tests identified.
- [ ] Missing tests listed.
- [ ] State ownership verified.
- [ ] TUI/headless behavior considered.
