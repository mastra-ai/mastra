# Mastra Code feature map

## Purpose

Map Mastra Code by **user-visible behavior** so future test work can quickly answer:

- What can the user do?
- Where does the state live?
- What tests already cover it?
- What is risky or missing?

Keep this as an index, not a dumping ground. Feature pages should be short cards.

## Folder shape

Organize by workflow area, not implementation layer:

```txt
features/
  chat/
  threads/
  models/
  tools/
  memory/
  subagents/
  goals/
  integrations/
  git/
  headless/
  settings/
```

Use one page per concrete user behavior. Update an existing page when a later PR changes the same behavior.

## Source-of-truth index

| Area | Feature | Origin | State owner | Tests | Risk | Page |
| --- | --- | --- | --- | --- | --- | --- |
| Setup | Installation and launch | #13294 | package metadata + startup runtime | Missing | Medium | [page](./setup/installation-and-launch.md) |
| TUI | Startup banner | #13422 | TUI options + terminal width | Partial | Medium | [page](./tui/startup-banner.md) |
| TUI | Help and shortcuts | #13426 | TUI command metadata + settings | Partial | Medium | [page](./tui/help-and-shortcuts.md) |
| TUI | File autocomplete | #13460 | editor autocomplete provider + `fd` detection | Partial | Medium | [page](./tui/file-autocomplete.md) |
| TUI | Terminal theme and contrast | #13487, #13503 | settings preference + terminal detection + theme helper API | Partial | Medium | [page](./tui/terminal-theme.md) |
| Settings | Onboarding and global settings | #13421, #13431, #13487, #13494, #13500, #13505, #13508 | settings.json + thread settings | Partial | High | [page](./settings/onboarding-and-global-settings.md) |
| Settings | Storage backend configuration | #13435 | env/settings + storage factory | Partial | High | [page](./settings/storage-backend.md) |
| TUI | Interactive chat | #13218, #13350, #13413, #13427, #13456, #13460, #13442, #13487 | TUI + Harness display state | Partial | High | [page](./tui/interactive-chat.md) |
| Chat | Prompt context and project instructions | #13234, #13346, #13376, #13456 | Harness request context + instruction files + git metadata | Partial | High | [page](./chat/prompt-context.md) |
| Git | Branch context and status | #13456 | live git branch + TUI project info | Missing | High | [page](./git/branch-context.md) |
| Chat | Queued follow-ups and slash commands | #13345, #13493 | TUI transient queue state + command template processor | Partial | High | [page](./chat/queued-followups.md) |
| Threads | Persistent conversations / switching | #13218, #13334, #13343 | Harness session + thread metadata | Partial | High | [page](./threads/persistent-conversations.md) |
| Models | Model auth, selection, modes | #13218, #13307, #13490 | Settings + harness session | Partial | High | [page](./models/model-auth-and-modes.md) |
| Models | Thinking and reasoning effort | #13490 | Harness state + settings | Partial | High | [page](./models/thinking-and-reasoning.md) |
| Tools | Coding tools and approval permissions | #13218, #13344, #13347, #13348, #13355, #13385, #13384, #13428, #13442 | Harness state + permission policy | Partial | High | [page](./tools/coding-tools-permissions.md) |
| Tools | Streaming tool arguments | #13328, #13335 | Harness display state + TUI pending tools | Partial | High | [page](./tools/streaming-tool-arguments.md) |
| Tools | Task tracking tools and TUI progress | #13344 | Harness task state + TUI progress | Partial | High | [page](./tools/task-tracking.md) |
| Integrations | MCP status and reload command | #13311, #13347 | MCP manager | Partial | High | [page](./integrations/mcp-status-command.md) |
| Integrations | Core Harness API and reference docs | #13353, #13457 | Core Harness runtime + docs | Partial | High | [page](./integrations/harness-api.md) |
| Integrations | Harness display state | #13427 | Core Harness display projection | Partial | High | [page](./integrations/harness-display-state.md) |
| Integrations | Skills command and workspace resolution | #13457 | Core Harness workspace cache + Workspace skills provider | Partial | High | [page](./integrations/skills-command.md) |
| Integrations | Lifecycle hooks | #13442 | hook config + TUI lifecycle + tool wrapper | Partial | High | [page](./integrations/lifecycle-hooks.md) |
| Git | Commit attribution | #13376 | Prompt context + harness model state | Missing | Medium | [page](./git/commit-attribution.md) |
| Goals | Plan approval and build handoff | #13416 | Core Harness plan resolver + TUI plan card | Partial | High | [page](./goals/plan-approval.md) |
| Subagents | Delegation to Explore / Plan / Execute | #13227, #13339 | Harness config + subagent session state | Partial | High | [page](./subagents/delegation.md) |
| Subagents | Audit-tests subagent | #13331 | Harness subagent config | Missing | High | [page](./subagents/audit-tests.md) |
| Memory | Observational memory | #13231, #13305, #13330, #13349, #13354, #13476 | Memory storage + harness/settings OM state | Partial | High | [page](./memory/observational-memory.md) |

Use terse values:

- **State owner:** source of truth, not every consumer.
- **Tests:** `Yes`, `Partial`, `Missing`, or `Unknown`.
- **Risk:** `High`, `Medium`, or `Low`; only mark low when verified.

## Page format

Copy [`_template.md`](./_template.md). Keep pages compact:

- Aim for bullets, not prose.
- Prefer 1–3 bullets per section.
- Put details in linked code references, not long explanations.
- Use `Unknown — needs verification` instead of guessing.

Required sections remain:

- Origin PR / commit
- User-visible behavior
- Entry points / commands
- TUI states
- Headless / non-TUI behavior
- Streaming / loading / interrupted states
- Streaming vs loaded-from-history behavior
- State ownership
- Key files
- Dependencies / related features
- Existing tests
- Missing tests
- Known risks / regressions
- Verification checklist

## Working queue

- [`_pr-queue.md`](./_pr-queue.md) — oldest-to-newest queue from squash-merged `mastracode/` history.

## Rules for agents

- Treat existing pages as leads, not truth.
- Verify claims against code, git history, tests, and current runtime behavior.
- Do not create duplicate pages for later PRs; update the existing feature card.
- Stop and adjust structure before adding more content if pages start getting long.
