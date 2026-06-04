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
  headless/
  settings/
```

Use one page per concrete user behavior. Update an existing page when a later PR changes the same behavior.

## Source-of-truth index

| Area | Feature | Origin | State owner | Tests | Risk | Page |
| --- | --- | --- | --- | --- | --- | --- |
| Setup | Installation and launch | #13294 | package metadata + startup runtime | Missing | Medium | [page](./setup/installation-and-launch.md) |
| TUI | Interactive chat | #13218 | TUI + harness session | Partial | High | [page](./tui/interactive-chat.md) |
| Chat | Prompt context and project instructions | #13234 | Harness request context + instruction files | Partial | High | [page](./chat/prompt-context.md) |
| Threads | Persistent conversations / switching | #13218, #13334 | Harness session + thread metadata | Partial | High | [page](./threads/persistent-conversations.md) |
| Models | Model auth, selection, modes | #13218, #13307 | Settings + harness session | Partial | High | [page](./models/model-auth-and-modes.md) |
| Tools | Coding tools and approval permissions | #13218 | Harness state + permission policy | Partial | High | [page](./tools/coding-tools-permissions.md) |
| Tools | Streaming tool arguments | #13328, #13335 | Harness display state + TUI pending tools | Partial | High | [page](./tools/streaming-tool-arguments.md) |
| Subagents | Delegation to Explore / Plan / Execute | #13227, #13339 | Harness config + subagent session state | Partial | High | [page](./subagents/delegation.md) |
| Subagents | Audit-tests subagent | #13331 | Harness subagent config | Missing | High | [page](./subagents/audit-tests.md) |
| Memory | Observational memory | #13231, #13305, #13330 | Memory storage + harness/settings OM state | Partial | High | [page](./memory/observational-memory.md) |

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
