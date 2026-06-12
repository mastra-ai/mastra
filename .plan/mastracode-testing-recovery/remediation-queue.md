# Mastra Code TUI e2e remediation queue

## Current state

- Checked-in TUI e2e coverage is no longer missing for any tracker row.
- 24 remaining partial rows are unfinished `needs-follow-up` tracker rows. This queue prioritizes residual contracts that still need deterministic coverage: broader user flows, integration-specific fixture depth, and remaining reload/history parity gaps.
- Keep the user-realism rule: drive behavior through terminal input, slash commands, AIMock fixtures, deterministic pre-launch config/DB seeds, or approved external signal APIs for notification/state-signal origins. Do not emit Harness internals or mutate runtime display state directly.

## Priority queue

### 1. Tool rendering live-vs-history parity

- Completed: `tool-history-reload` seeds completed persisted `view`, `task_write`, and `web_search_20250305` messages into an isolated DB, opens `/threads`, and asserts reconstructed render matches live e2e expectations. This validates `Tools: Streaming tool arguments` and `Tools: Web search tool rendering`, and reduces the residual gaps for task tracking, harness display state, and workspace tools.
- Completed: `task-inline-transitions` uses AIMock tool-call fixtures for `task_write` → `task_complete` → clearing `task_write`, then asserts completed and cleared inline rendering in the live PTY TUI.
- Completed: `task-patch-tools` uses AIMock tool-call fixtures for `task_write` → `task_update` → `task_check`, then asserts patched pinned task state and rendered check output in the live PTY TUI.
- Completed: `task-prompt-context-next-turn` drives a live `task_write`, submits a later user prompt, and only matches the final AIMock fixture when the outbound system prompt contains the updated `<current-task-list>` ID and content.
- Completed: `workspace-tool-output-rendering` uses AIMock tool-call fixtures for live `execute_command` and `lsp_inspect`, writes a deterministic TypeScript file, and asserts visible shell stdout/footer plus LSP file/line/match rendering in the real PTY TUI.
- Completed: `workspace-plan-mode-tools` captures build-mode and plan-mode provider-visible tool dictionaries through real TUI prompts and proves plan mode removes workspace write/edit tools while preserving read/search/LSP tools.
- Remaining row: `Integrations: Harness display state`.
- Fixture/data needs: any remaining sanitized stored-message fixtures for edit/list and persisted shell breadth can be considered follow-up breadth, but the workspace-backed coding tools tracker row is validated.

### 2. Notification and state signals beyond first render

- Rows: `Chat: Notification inbox signals`, `Chat: Processor state signals`.
- Completed: `notification-inbox-tool-flow` sends a public medium-priority notification signal during an active run, renders the active summary card, then uses AIMock to call `notification_inbox read` and asserts the delivered details render in the same TUI thread.
- Completed: `notification-inbox-crud-flow` seeds deterministic notification records, uses AIMock to call `notification_inbox list`, `markSeen`, `dismiss`, `archive`, and `search`, and asserts list-only visibility plus searchable `seen`, `dismissed`, and `archived` status transitions in the real TUI.
- Completed: `notification-inbox-reload` seeds persisted notification and notification-summary signal DB messages, reloads them through `/threads`, and asserts loaded-history summary counts/hint plus dismissed, archived, and coalesced pending notification cards.
- Completed: `state-signal-reload` seeds a persisted state signal DB message, reloads it through `/threads`, and asserts loaded-history `State delta: browser` rendering with the persisted preview.
- Proposed scenarios:
  - `state-signal-browser-pruning`: drive a browser-processor-backed state source or sanitized long-session fixture to verify live browser snapshot/delta projection and pruning behavior.
- Fixture/data needs: sanitized notification/state-signal DB rows; AIMock `notification_inbox` tool-call fixtures.

### 3. GitHub signals incremental flow

- Row: `Git: GitHub signal subscriptions`.
- Completed: `github-signals-incremental` seeds a persisted subscribed thread whose cursor last observed failing CI, points `MASTRACODE_GITCRAWL_BIN` at a deterministic recovered gitcrawl sqlite snapshot, runs `/github sync`, and asserts the `pull-request-ci-recovered` notification plus `/github debug` `ci=success` cursor update.
- Proposed scenarios:
  - `github-signals-unsubscribe-reload`: subscribe via `/github subscribe`, unsubscribe via `/github unsubscribe`, reload `/github debug`, and assert metadata/polling stops.
- Fixture/data needs: sanitized sqlite fixture derived from `~/.config/gitcrawl/gitcrawl.db`; mock gitcrawl binary for unsubscribe/reload or multi-process polling breadth.

### 4. MCP and browser integration depth

- Rows: `Integrations: MCP server configuration`, `MCP status and reload command`, `Browser automation`.
- Proposed scenarios:
  - `mcp-http-tool-call`: launch local HTTP/SSE mock MCP server before TUI; assert `/mcp status` success and an AIMock model turn invoking one MCP tool.
  - `mcp-reload-config`: pre-launch config-file server, `/mcp reload`, status transition.
  - `browser-toggle-attach`: drive `/browser on` with a local/mock browser endpoint if available; otherwise keep as explicit manual/lab follow-up.
- Fixture/data needs: local mock MCP server fixture, optional OAuth/token fixture if testing auth refresh; no live browser credentials.

### 5. Settings and model UI breadth

- Rows: `Setup: Installation and launch`, `Setup: Auto-update prompts`, `Settings: Storage backend configuration`, `Settings: Quiet mode`, `Settings: Onboarding and global settings`, `Models: Custom OpenAI-compatible providers`, `Models: Provider history compatibility`, `Models: Stream error retry processor`.
- Proposed scenarios:
  - Completed: `setup-nested-model-selector` opens `/setup`, selects the custom model pack, enters a pack name, opens the nested model selector, cancels it with Escape, and asserts the parent setup overlay resumes without leaving the selector stuck.
  - Completed: `om-global-settings-persistence` creates an active thread, toggles `/om` caveman and attachment settings through the real overlay, then proves global settings and active-thread metadata projections update.
  - Completed: `setup-completion-persistence` seeds Memory Gateway provider access, steps `/setup` through OpenAI mode/OM pack selection and Disable YOLO, then proves completed/skipped state, pack IDs, YOLO, and built-in default persistence in `settings.json`.
  - Completed: `models-pack-activation-persistence` seeds a custom provider plus saved custom pack, activates it through `/models`, then proves active pack ID, custom mode defaults, stale subagent override cleanup, and custom pack retention in `settings.json`.
  - Completed: `api-key-delete-env` seeds a stored `302ai` API key alongside a real `302AI_API_KEY`, deletes the stored key through `/api-keys`, and proves the TUI falls back to env status while `auth.json` is cleared and the real env key remains intact.
  - Completed: `custom-provider-delete` seeds a custom OpenAI-compatible provider, deletes it through `/custom-providers`, confirms the destructive modal, and proves `settings.json` removes the provider while unrelated saved custom packs remain intact.
  - Completed: `model-selection-api-key-prompt` edits a saved custom pack through `/models`, selects a synthetic `302ai` model with no configured key, verifies the masked missing-key dialog/env hint, and proves stored auth/env projection plus saved pack settings update.
  - Completed: `browser-settings-persistence` uses `/browser set`/`clear` quick commands to prove CDP/profile mutual exclusion, Stagehand profile preservation cleanup, and executable-path persistence in `settings.json` without launching a live browser.
  - Completed: `custom-pack-import-overwrite` imports a shared `mastra-pack:` string through `/models`, confirms overwrite on a colliding saved pack, and proves imported model defaults plus active pack persistence in `settings.json`.
  - Completed: `custom-pack-rename-active` renames an active saved custom pack through `/models` Edit, saves it, and proves active/onboarding pack IDs migrate while the old pack entry is removed and model defaults remain intact.
  - Completed: `settings-startup-model-restore` seeds an active custom pack before launch, asserts the startup footer uses the persisted build model, and verifies `/models` still lists the saved pack plus persisted settings remain intact.
  - `onboarding-full-wizard`: remaining breadth for login refresh and custom pack completion.
  - `update-startup-prompt`: use existing update env seams to assert passive startup prompt, then `Yes` path with a stub install command if a safe seam is added.
  - Completed: `quiet-tool-history-parity` enables Quiet mode in settings, drives AIMock-backed live `view` + `task_write`, asserts compact tool/task rendering, then reloads a seeded tool-history thread and asserts loaded quiet compact rendering.
  - `settings-reload-persistence`: combine remaining storage/browser/custom-provider changes, relaunch scenario, assert settings persist without relying on runtime state; active custom model-pack startup restore is covered by `settings-startup-model-restore`.
  - `custom-provider-edit-share-import`: exercise provider edit/share and remaining custom-pack share/import-cancel modals plus `/models` selection visibility; delete persistence is covered by `custom-provider-delete`, shared-pack import collision/overwrite is covered by `custom-pack-import-overwrite`, and active-pack rename/edit persistence is covered by `custom-pack-rename-active`.
  - `provider-history-rejection-retry`: custom provider that rejects reasoning once, then verifies `ProviderHistoryCompat` error-processor retry specifically handles the rejection.
- Fixture/data needs: settings.json seeds, AIMock custom provider fixtures, one-shot local HTTP provider mock for rejection/retry cases.

### 6. Workspace, skills, hooks, and shell surfaces

- Rows: `Skills command and workspace resolution`, `Lifecycle hooks`, `Shell passthrough streaming`, `Process suspend shortcut`, `File attachments in chat input`, `Observational memory`.
- Proposed scenarios:
  - `skills-goal-alias`: create deterministic skill aliases and assert `/skills` plus goal-skill resolution through a real prompt.
  - `hooks-configured-blocking`: pre-launch hook config that blocks a tool or emits visible status; assert `/hooks` and model/tool run behavior.
  - `shell-streaming-long-output`: run shell command with multi-line/streamed output and verify bordered stdout/stderr truncation.
  - Completed: `request-access-modal` uses an AIMock `request_access` tool call to an inaccessible path, asserts the real approval prompt, approves via Enter, renders the granted result, and reads a deterministic external file through `view` after the path is allowed.
  - Completed: `ask-user-advanced-prompts` uses AIMock `ask_user` calls to assert multiline free-text input, single-select `Custom response...` switching to typed input, and fixed-option multi-select toggling through the real PTY TUI.
  - Completed: `prompt-queue-interleave` uses simultaneous AIMock `ask_user` and `request_access` tool calls to assert the access prompt is queued behind the active ask_user prompt, activates after the first answer, accepts the default Yes option, and resolves the model turn.
  - `file-attachment-submit`: text file + image attachment through real input, assert request body attachment counts/content.
  - `om-background-recall`: seed sanitized observational memory, drive a prompt that recalls it, assert provenance/rendering.
- Fixture/data needs: deterministic skill/hook config files, AIMock tool-call fixtures, sanitized OM observations from local Application Support if needed.

## Suggested execution order

1. Tool history/reload parity, because the high-risk goal branches are now validated and live-vs-loaded rendering remains the broadest remaining gap.
2. Tool reload/history parity, because many partial rows share the same DB-seed fixture work.
3. Notification/state signal state transitions, because public signal APIs are already allowed but CRUD/reload parity is missing.
4. GitHub incremental mock-gitcrawl, because the binary override and sanitized sqlite fixture already exist.
5. MCP/settings/workspace breadth as smaller focused batches.
