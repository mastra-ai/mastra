# Mastra Code TUI e2e remediation queue

## Current state

- Checked-in TUI e2e coverage is no longer missing for any tracker row.
- 30 remaining partial rows are unfinished `needs-follow-up` tracker rows. This queue prioritizes residual contracts that still need deterministic coverage: broader user flows, integration-specific fixture depth, and remaining reload/history parity gaps.
- Keep the user-realism rule: drive behavior through terminal input, slash commands, AIMock fixtures, deterministic pre-launch config/DB seeds, or approved external signal APIs for notification/state-signal origins. Do not emit Harness internals or mutate runtime display state directly.

## Priority queue

### 1. Tool rendering live-vs-history parity

- Completed: `tool-history-reload` seeds completed persisted `view`, `task_write`, and `web_search_20250305` messages into an isolated DB, opens `/threads`, and asserts reconstructed render matches live e2e expectations. This validates `Tools: Streaming tool arguments` and `Tools: Web search tool rendering`, and reduces the residual gaps for task tracking, harness display state, and workspace tools.
- Completed: `task-inline-transitions` uses AIMock tool-call fixtures for `task_write` → `task_complete` → clearing `task_write`, then asserts completed and cleared inline rendering in the live PTY TUI.
- Completed: `task-patch-tools` uses AIMock tool-call fixtures for `task_write` → `task_update` → `task_check`, then asserts patched pinned task state and rendered check output in the live PTY TUI.
- Remaining rows: `Tools: Task tracking tools and TUI progress`, `Integrations: Harness display state`, `Tools: Workspace-backed coding tools`.
- Completed: `workspace-tool-output-rendering` uses AIMock tool-call fixtures for live `execute_command` and `lsp_inspect`, writes a deterministic TypeScript file, and asserts visible shell stdout/footer plus LSP file/line/match rendering in the real PTY TUI.
- Proposed scenarios:
  - `task-prompt-context-next-turn`: seed or mutate task state, start a new user turn, and assert AIMock sees the updated `<current-task-list>` prompt context.
- Fixture/data needs: AIMock tool-call fixtures for live path plus any remaining sanitized stored-message fixtures for edit/list and persisted shell breadth.

### 2. Notification and state signals beyond first render

- Rows: `Chat: Notification inbox signals`, `Chat: Processor state signals`.
- Proposed scenarios:
  - `notification-inbox-tool-flow`: send a public notification signal during active run, then use AIMock to call `notification_inbox` actions (`list`, `read`, `markSeen`) and assert rendered summary/details and state transition.
  - `notification-reload`: seed notification signal/message history and assert summary/provenance survives `/threads` reload.
  - `state-signal-reload-pruning`: public `sendStateSignal()` plus seeded/reloaded long-session state to verify snapshot/delta projection and pruning behavior.
- Fixture/data needs: sanitized notification/state-signal DB rows; AIMock `notification_inbox` tool-call fixtures.

### 3. GitHub signals incremental flow

- Row: `Git: GitHub signal subscriptions`.
- Proposed scenarios:
  - `github-signals-incremental`: extend the temp `MASTRACODE_GITCRAWL_BIN` mock to return baseline data, then changed CI/check/review data on a second sync; assert incremental notification classification.
  - `github-signals-unsubscribe-reload`: subscribe via `/github subscribe`, unsubscribe via `/github unsubscribe`, reload `/github debug`, and assert metadata/polling stops.
- Fixture/data needs: sanitized sqlite fixture derived from `~/.config/gitcrawl/gitcrawl.db`; mock gitcrawl binary that can serve multiple snapshots by call count.

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
  - `onboarding-full-wizard`: clean config, step through auth/model/OM/YOLO choices, assert persisted settings.
  - `update-startup-prompt`: use existing update env seams to assert passive startup prompt, then `Yes` path with a stub install command if a safe seam is added.
  - `settings-reload-persistence`: combine quiet/storage/custom-provider changes, relaunch scenario, assert settings persist without relying on runtime state.
  - `custom-provider-edit-delete`: exercise edit/delete provider modals and `/models` selection visibility.
  - `provider-history-rejection-retry`: custom provider that rejects reasoning once, then verifies `ProviderHistoryCompat` error-processor retry specifically handles the rejection.
- Fixture/data needs: settings.json seeds, AIMock custom provider fixtures, one-shot local HTTP provider mock for rejection/retry cases.

### 6. Workspace, skills, hooks, and shell surfaces

- Rows: `Skills command and workspace resolution`, `Lifecycle hooks`, `Shell passthrough streaming`, `Process suspend shortcut`, `Interactive prompts and access requests`, `File attachments in chat input`, `Observational memory`.
- Proposed scenarios:
  - `skills-goal-alias`: create deterministic skill aliases and assert `/skills` plus goal-skill resolution through a real prompt.
  - `hooks-configured-blocking`: pre-launch hook config that blocks a tool or emits visible status; assert `/hooks` and model/tool run behavior.
  - `shell-streaming-long-output`: run shell command with multi-line/streamed output and verify bordered stdout/stderr truncation.
  - `request-access-modal`: AIMock `request_access` tool call to an inaccessible path, assert approval modal/cancel flow.
  - `file-attachment-submit`: text file + image attachment through real input, assert request body attachment counts/content.
  - `om-background-recall`: seed sanitized observational memory, drive a prompt that recalls it, assert provenance/rendering.
- Fixture/data needs: deterministic skill/hook config files, AIMock tool-call fixtures, sanitized OM observations from local Application Support if needed.

## Suggested execution order

1. Tool history/reload parity, because the high-risk goal branches are now validated and live-vs-loaded rendering remains the broadest remaining gap.
2. Tool reload/history parity, because many partial rows share the same DB-seed fixture work.
3. Notification/state signal state transitions, because public signal APIs are already allowed but CRUD/reload parity is missing.
4. GitHub incremental mock-gitcrawl, because the binary override and sanitized sqlite fixture already exist.
5. MCP/settings/workspace breadth as smaller focused batches.
