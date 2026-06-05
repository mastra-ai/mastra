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
| Setup | Installation and launch | #13294, #13560, #13648, #13760, #13767, #13768 | package metadata + startup runtime | Partial | Medium | [page](./setup/installation-and-launch.md) |
| Setup | Auto-update prompts | #13603, #13760, #13767, #13768, #13787 | npm registry helpers + build-time/source version + settings dismissed version | Partial | Medium | [page](./setup/auto-update-prompts.md) |
| Headless | Prompt mode | #13648 | CLI args + Harness events + auto-resolution | Partial | High | [page](./headless/prompt-mode.md) |
| TUI | Startup banner | #13422 | TUI options + terminal width | Partial | Medium | [page](./tui/startup-banner.md) |
| TUI | Help and shortcuts | #13426, #13712, #13723, #13787 | TUI command metadata + settings | Partial | Medium | [page](./tui/help-and-shortcuts.md) |
| TUI | Interactive prompts and access requests | #13696, #13753 | TUI active prompt + pending prompt queue + sandbox allowed paths | Partial | High | [page](./tui/interactive-prompts.md) |
| TUI | Process suspend shortcut | #13723 | TUI keyboard routing + Unix signal handling | Partial | Medium | [page](./tui/process-suspend.md) |
| TUI | Clipboard paste | #13712, #13953 | OS clipboard helpers + editor paste buffer + pending pasted images | Partial | High | [page](./tui/clipboard-paste.md) |
| TUI | File autocomplete | #13460 | editor autocomplete provider + `fd` detection | Partial | Medium | [page](./tui/file-autocomplete.md) |
| TUI | Terminal theme and contrast | #13487, #13503 | settings preference + terminal detection + theme helper API | Partial | Medium | [page](./tui/terminal-theme.md) |
| TUI | Quiet mode | #13556 | settings preference + TUI render state | Partial | High | [page](./tui/quiet-mode.md) |
| Settings | Onboarding and global settings | #13421, #13431, #13487, #13494, #13500, #13505, #13508, #13512, #13566, #13603, #13611, #13748, #13953 | settings.json + thread settings + provider registry + AuthStorage | Partial | High | [page](./settings/onboarding-and-global-settings.md) |
| Settings | Storage backend configuration | #13435, #13815 | env/settings/database config + storage factory | Partial | High | [page](./settings/storage-backend.md) |
| TUI | Interactive chat | #13218, #13350, #13413, #13427, #13456, #13460, #13442, #13487, #13609, #13696, #13712, #13723, #13999 | TUI + Harness display state | Partial | High | [page](./tui/interactive-chat.md) |
| TUI | Shell passthrough streaming | #13999 | TUI input router + shell subprocess + live output component | Partial | Medium | [page](./tui/shell-passthrough.md) |
| TUI | Debug logging | #13691, #13701 | env vars + app-data/debug trace files | Partial | Medium | [page](./tui/debug-logging.md) |
| Chat | Prompt context and project instructions | #13234, #13346, #13376, #13456 | Harness request context + instruction files + git metadata | Partial | High | [page](./chat/prompt-context.md) |
| Chat | File attachments in chat input | #13574, #13712, #13953 | Harness signal content + message-list adapters + TUI pending images + OM attachment input | Partial | High | [page](./chat/file-attachments.md) |
| Git | Branch context and status | #13456 | live git branch + TUI project info | Missing | High | [page](./git/branch-context.md) |
| Chat | Queued follow-ups and slash commands | #13345, #13493 | TUI transient queue state + command template processor | Partial | High | [page](./chat/queued-followups.md) |
| Threads | Persistent conversations / switching | #13218, #13334, #13343 | Harness session + thread metadata | Partial | High | [page](./threads/persistent-conversations.md) |
| Threads | Resource ID switching | #13690 | Harness resource ID + resource-scoped threads | Partial | High | [page](./threads/resource-id-switching.md) |
| Models | Model auth, selection, modes | #13218, #13307, #13490, #13512, #13566, #13600, #13611, #13695, #13716 | Settings + harness session + thread pack metadata + provider registry + AuthStorage | Partial | High | [page](./models/model-auth-and-modes.md) |
| Models | Custom OpenAI-compatible providers | #13682, #13611 | settings customProviders + Harness custom catalog | Partial | High | [page](./models/custom-providers.md) |
| Models | Thinking and reasoning effort | #13490, #13563, #13748 | Harness/request context + settings | Partial | High | [page](./models/thinking-and-reasoning.md) |
| Models | OpenAI strict schema compatibility | #13695, #14157 | schema-compat + core stream strict-mode preparation | Partial | High | [page](./models/openai-strict-schema-compat.md) |
| Models | Tool schema compatibility | #13253, #13695, #14157, #14264 | Standard Schema adapters + Zod JSON Schema conversion + Zod module export handling | Partial | High | [page](./models/tool-schema-compatibility.md) |
| Tools | Coding tools and approval permissions | #13218, #13344, #13347, #13348, #13355, #13385, #13384, #13428, #13442, #13519, #13526, #13564, #13609, #13611, #13687, #13696, #13713, #13724, #13753, #13870, #13999, #14157, #14168 | Harness state + permission policy + workspace filesystem + extraTools + schemas + local shell passthrough + validation errors | Partial | High | [page](./tools/coding-tools-permissions.md) |
| Tools | Web search tool rendering | #13609, #13870 | provider/Tavily result shape + TUI renderer | Partial | Medium | [page](./tools/web-search-rendering.md) |
| Tools | Workspace-backed coding tools | #13437, #13526, #13687, #13693, #13695, #13700, #13724, #13753, #13940 | core/custom Workspace + LocalFilesystem/LocalSandbox + tool-name overrides + allowed paths + schema compat + subagent inheritance | Partial | High | [page](./tools/workspace-tools.md) |
| Tools | Streaming tool arguments | #13328, #13335 | Harness display state + TUI pending tools | Partial | High | [page](./tools/streaming-tool-arguments.md) |
| Tools | Task tracking tools and TUI progress | #13344 | Harness task state + TUI progress | Partial | High | [page](./tools/task-tracking.md) |
| Integrations | MCP status and reload command | #13311, #13347 | MCP manager | Partial | High | [page](./integrations/mcp-status-command.md) |
| Integrations | MCP server configuration | #13613, #13750 | MCP config files + programmatic config + manager runtime state | Partial | High | [page](./integrations/mcp-server-configuration.md) |
| Integrations | Core Harness API and reference docs | #13353, #13457, #13519, #13525, #13716 | Core Harness runtime + docs | Partial | High | [page](./integrations/harness-api.md) |
| Integrations | Harness display state | #13427 | Core Harness display projection | Partial | High | [page](./integrations/harness-display-state.md) |
| Integrations | Skills command and workspace resolution | #13457, #13700 | Core Harness workspace cache + Workspace skills provider | Partial | High | [page](./integrations/skills-command.md) |
| Integrations | Lifecycle hooks | #13442 | hook config + TUI lifecycle + tool wrapper | Partial | High | [page](./integrations/lifecycle-hooks.md) |
| Integrations | GitHub issue reporting command | #13605 | TUI command prompt + GitHub CLI side effects | Partial | High | [page](./integrations/github-issue-reporting.md) |
| Git | Commit attribution | #13376 | Prompt context + harness model state | Missing | Medium | [page](./git/commit-attribution.md) |
| Goals | Plan approval and build handoff | #13416, #13557, #13598 | Core Harness plan resolver + TUI plan card + plan files | Partial | High | [page](./goals/plan-approval.md) |
| Subagents | Delegation to Explore / Plan / Execute | #13227, #13339, #13700, #13940 | Harness config + parent Workspace + subagent request context/session state | Partial | High | [page](./subagents/delegation.md) |
| Subagents | Audit-tests subagent | #13331 | Harness subagent config | Missing | High | [page](./subagents/audit-tests.md) |
| Memory | Observational memory | #13231, #13305, #13330, #13349, #13354, #13476, #13568, #13563, #13569, #13815, #13953, #13996 | Memory storage + harness/settings OM state + scope config + observer-context budgeting + attachment filtering/token estimates + OM model picker + clone remapping | Partial | High | [page](./memory/observational-memory.md) |

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
