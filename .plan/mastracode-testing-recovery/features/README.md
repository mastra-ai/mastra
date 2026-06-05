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
| Setup | Installation and launch | #13294, #13560, #13648, #13760, #13767, #13768, #14541, #14586 | package metadata + dependency ranges + startup runtime + macOS sleep-prevention process | Partial | Medium | [page](./setup/installation-and-launch.md) |
| Setup | Auto-update prompts | #13603, #13760, #13767, #13768, #13787, #15924 | npm registry/helpers + unpkg changelog parsing + build-time/source version + settings dismissed version | Partial | Medium | [page](./setup/auto-update-prompts.md) |
| Headless | Prompt mode | #13648, #14962, #14909, #15423, #16006 | CLI args + Harness events + auto-resolution + model/mode preflight + thread/resource controls + automation output formats + stdin pipe/TUI fallback routing | Partial | High | [page](./headless/prompt-mode.md) |
| TUI | Startup banner | #13422 | TUI options + terminal width | Partial | Medium | [page](./tui/startup-banner.md) |
| TUI | Help and shortcuts | #13426, #13712, #13723, #13787, #14250, #15036, #15014, #15642 | TUI command metadata + settings + queueing shortcut labels + browser/API-key/observability command listing | Partial | Medium | [page](./tui/help-and-shortcuts.md) |
| TUI | Interactive prompts and access requests | #13696, #13753, #14479, #14845, #14936, #15395 | TUI active prompt + pending prompt queue + multiline ask_user input + answered-prompt wrapping/custom response mode + masked sensitive input + sandbox allowed paths | Partial | High | [page](./tui/interactive-prompts.md) |
| TUI | Process suspend shortcut | #13723 | TUI keyboard routing + Unix signal handling | Partial | Medium | [page](./tui/process-suspend.md) |
| TUI | Clipboard paste | #13712, #13953 | OS clipboard helpers + editor paste buffer + pending pasted images | Partial | High | [page](./tui/clipboard-paste.md) |
| TUI | File autocomplete | #13460 | editor autocomplete provider + `fd` detection | Partial | Medium | [page](./tui/file-autocomplete.md) |
| TUI | Terminal theme and contrast | #13487, #13503, #14337, #14359 | settings preference + terminal detection + adapted palette + solid editor border | Partial | Medium | [page](./tui/terminal-theme.md) |
| TUI | Configuration modal overlays | #16274 | shared modal sizing/padding + modal question helper + setup/config command overlays + neutral tool pending/success backgrounds | Partial | High | [page](./tui/configuration-overlays.md) |
| TUI | Quiet mode | #13556 | settings preference + TUI render state | Partial | High | [page](./tui/quiet-mode.md) |
| Settings | Onboarding and global settings | #13421, #13431, #13487, #13494, #13500, #13505, #13508, #13512, #13566, #13603, #13611, #13748, #13953, #13573, #14604, #14605, #14788, #14952, #14936, #15036, #15014, #15194, #15359, #16274 | settings.json + thread settings + provider registry + AuthStorage/stored API keys + built-in pack defaults + browser profile/executable settings + OM threshold/caveman defaults + Memory Gateway settings + masked sensitive prompts + modal setup/config flows | Partial | High | [page](./settings/onboarding-and-global-settings.md) |
| Settings | Storage backend configuration | #13435, #13815, #16135 | env/settings/database config + storage factory + normalized storage prompt key handling | Partial | High | [page](./settings/storage-backend.md) |
| TUI | Interactive chat | #13218, #13350, #13413, #13427, #13456, #13460, #13442, #13487, #13609, #13696, #13712, #13723, #13999, #14423, #15082, #15088, #15942, #15993, #16006 | TUI + Harness display state + prompt/editor animation + optimistic/piped user-message projection + full-width border sizing + count-based rendered component pruning | Partial | High | [page](./tui/interactive-chat.md) |
| TUI | Shell passthrough streaming | #13999, #15092, #15566 | TUI input router + shell subprocess + live collapsible output component + bounded ANSI/OSC parsing | Partial | Medium | [page](./tui/shell-passthrough.md) |
| TUI | Debug logging | #13691, #13701 | env vars + app-data/debug trace files | Partial | Medium | [page](./tui/debug-logging.md) |
| Chat | Prompt context and project instructions | #13234, #13346, #13376, #13456, #14587, #14688, #14637, #14790, #14961, #14435, #15352, #15359, #15759, #15820, #16065, #16326 | Harness request context + static/dynamic capped instruction files + API-error retry reminders + git metadata/common binaries + exact-ID model-specific prompt sections + request_access/autonomy guidance + memory-style caveat + goal context + tokenx-estimated reminder caps + late tone/style guidance | Partial | High | [page](./chat/prompt-context.md) |
| Chat | File attachments in chat input | #13574, #13712, #13953 | Harness signal content + message-list adapters + TUI pending images + OM attachment input | Partial | High | [page](./chat/file-attachments.md) |
| Git | Branch context and status | #13456 | live git branch + TUI project info | Missing | High | [page](./git/branch-context.md) |
| Chat | Queued follow-ups and slash commands | #13345, #13493, #14250, #14727, #15678 | TUI transient queue state + active-thread custom commands + custom command loader/processor + active-run signal/queue routing | Partial | High | [page](./chat/queued-followups.md) |
| Threads | Persistent conversations / switching | #13218, #13334, #13343, #14428, #14436, #14690, #14691, #14567, #15749 | Harness session + thread metadata + all-resource selector + cache-only preview/title display + `/thread` provenance + OM title updates + thread-boundary ephemeral cleanup | Partial | High | [page](./threads/persistent-conversations.md) |
| Threads | Resource ID switching | #13690 | Harness resource ID + resource-scoped threads | Partial | High | [page](./threads/resource-id-switching.md) |
| Models | Model auth, selection, modes | #13218, #13307, #13490, #13512, #13566, #13600, #13611, #13695, #13716, #13573, #14433, #14469, #14604, #14605, #14867, #14952, #14936, #15014, #15370, #14909, #15458, #15483, #15631, #15703, #15759, #16294, #16332 | Settings + harness session + thread pack metadata + provider registry/cache generation/corrupt-cache fallback + AuthStorage/stored API keys + `/api-keys` management + Memory Gateway settings/proxy + harness headers + model-pack share/import payloads + headless model preflight + GPT-5.5 built-in defaults + provider key fallback chain + masked key input + normalized TUI model labels + custom OM model role overrides + Codex OAuth callback port fallback | Partial | High | [page](./models/model-auth-and-modes.md) |
| Models | Custom OpenAI-compatible providers | #13682, #13611, #14433 | settings customProviders + Harness custom catalog + harness headers | Partial | High | [page](./models/custom-providers.md) |
| Models | Thinking and reasoning effort | #13490, #13563, #13748 | Harness/request context + settings | Partial | High | [page](./models/thinking-and-reasoning.md) |
| Models | OpenAI strict schema compatibility | #13695, #14157 | schema-compat + core stream strict-mode preparation | Partial | High | [page](./models/openai-strict-schema-compat.md) |
| Models | Tool schema compatibility | #13253, #13695, #14157, #14264 | Standard Schema adapters + Zod JSON Schema conversion + Zod module export handling | Partial | High | [page](./models/tool-schema-compatibility.md) |
| Models | Provider history compatibility | #15730, #16176 | core provider-boundary prompt hook + prompt/error processor rules + provider-scoped history rewrites + Mastra Code agent wiring | Partial | High | [page](./models/provider-history-compat.md) |
| Models | Stream error retry processor | #15760 | core stream error matcher + retry-count guard + Mastra Code error processor wiring | Partial | High | [page](./models/stream-error-retry.md) |
| Tools | Coding tools and approval permissions | #13218, #13344, #13347, #13348, #13355, #13385, #13384, #13428, #13442, #13519, #13526, #13564, #13609, #13611, #13687, #13696, #13713, #13724, #13753, #13870, #13999, #14157, #14168, #14565, #14535, #15566, #16326 | Harness state + permission policy + workspace filesystem + extraTools + schemas + local shell passthrough + validation errors + safe tool-result serialization + bounded parser/rendering helpers + tokenx-estimated output budgets + LSP inspect category | Partial | High | [page](./tools/coding-tools-permissions.md) |
| Tools | Web search tool rendering | #13609, #13870, #15448, #16326 | provider/Tavily result shape + @mastra/tavily package + Mastra Code wrapper formatting + tokenx-estimated wrapper caps + TUI renderer | Partial | Medium | [page](./tools/web-search-rendering.md) |
| Tools | Workspace-backed coding tools | #13437, #13526, #13687, #13693, #13695, #13700, #13724, #13753, #13940, #14565, #14961, #15151, #15228, #15566, #16094 | core/custom Workspace + LocalFilesystem/LocalSandbox + tool-name overrides + allowed paths + default temp scratch paths + Agent Skills directories + canonical symlink skill aliases + procedural path parsing + request_access guidance + schema compat + subagent inheritance + LSP inspect | Partial | High | [page](./tools/workspace-tools.md) |
| Tools | Streaming tool arguments | #13328, #13335, #14472, #14535, #15566 | Harness display state + TUI pending tools + argument/result highlight/safe serialization + bounded error/ANSI parsing | Partial | High | [page](./tools/streaming-tool-arguments.md) |
| Tools | Task tracking tools and TUI progress | #13344, #15192, #15749, #16254 | Harness task state + stable task IDs + patch/check tools + TUI progress + thread-boundary reset for tasks/plan/access/task UI | Partial | High | [page](./tools/task-tracking.md) |
| Integrations | MCP status and reload command | #13311, #13347, #14377, #14960 | MCP manager + long timeout + selector overlay | Partial | High | [page](./integrations/mcp-status-command.md) |
| Integrations | MCP server configuration | #13613, #13750, #14377, #14960 | MCP config files + programmatic config + manager runtime state + long tool timeout | Partial | High | [page](./integrations/mcp-server-configuration.md) |
| Integrations | Core Harness API and reference docs | #13353, #13457, #13519, #13525, #13716, #14433, #15036, #16250, #13891, #16340 | Core Harness runtime + docs + model request headers + browser propagation + createMastraCode memory override + plan approval resolver/abort ordering | Partial | High | [page](./integrations/harness-api.md) |
| Integrations | Browser automation | #15036, #15194 | settings.json browser config + profile/executable launch options + Harness browser propagation + core Agent browser context | Partial | High | [page](./integrations/browser-automation.md) |
| Integrations | Harness display state | #13427 | Core Harness display projection | Partial | High | [page](./integrations/harness-display-state.md) |
| Integrations | Skills command and workspace resolution | #13457, #13700, #15151, #15228, #15566, #16068 | Core Harness workspace cache + Workspace skills provider + Agent Skills directories + canonical symlink alias de-duping + procedural versioned path normalization + quiet existing-dir skill startup behavior | Partial | High | [page](./integrations/skills-command.md) |
| Integrations | Lifecycle hooks | #13442, #14586 | hook config + TUI lifecycle + tool wrapper + macOS keep-awake lifecycle | Partial | High | [page](./integrations/lifecycle-hooks.md) |
| Integrations | GitHub issue reporting command | #13605 | TUI command prompt + GitHub CLI side effects | Partial | High | [page](./integrations/github-issue-reporting.md) |
| Integrations | Observability and eval feedback | #15642 | settings/AuthStorage observability config + DuckDB/cloud exporters + eval context builder + outcome/efficiency scorers + `/feedback` trace correlation | Partial | High | [page](./integrations/observability-and-evals.md) |
| Git | Commit attribution | #13376 | Prompt context + harness model state | Missing | Medium | [page](./git/commit-attribution.md) |
| Goals | Plan approval and build handoff | #13416, #13557, #13598, #16065, #16340 | Core Harness plan resolver + TUI plan card + plan files + resolver-first build/goal handoff | Partial | High | [page](./goals/plan-approval.md) |
| Goals | Persistent `/goal` mode | #16065, #16322, #16340 | thread goal metadata + GoalManager + judge agent/defaults + TUI judge/input-lock state + approved-plan goal start ordering | Partial | High | [page](./goals/persistent-goals.md) |
| Subagents | Delegation to Explore / Plan / Execute | #13227, #13339, #13700, #13940, #14804, #15088, #15695 | Harness config + parent Workspace + configured subagent picker + subagent model defaults + subagent request context/session state + forked parent-thread clones/toolsets | Partial | High | [page](./subagents/delegation.md) |
| Subagents | Audit-tests subagent | #13331 | Harness subagent config | Missing | High | [page](./subagents/audit-tests.md) |
| Memory | Observational memory | #13231, #13305, #13330, #13349, #13354, #13476, #13568, #13563, #13569, #13815, #13953, #13996, #14436, #14437, #14567, #14788, #14790, #14952, #15359, #15365, #15420, #15462, #15566, #15605, #15703, #16275 | Memory storage/vector index + gateway memory proxy + harness/settings OM state + persisted thresholds/caveman mode + thread OM toggle restore/seed + temporal-gap markers + idle/provider-change activation + reflection overshoot guards + bounded thread-tag stripping + scope config + retrieval/recall provenance + cross-thread access guards + observer-context budgeting + attachment filtering/token estimates + OM custom model picker + dynamic-reminder exclusion + clone remapping + generated thread titles | Partial | High | [page](./memory/observational-memory.md) |

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
