# Mastra Code TUI e2e remediation queue

## Current state

- Checked-in TUI e2e coverage is no longer missing for any tracker row.
- 1 remaining partial row is an unfinished `needs-follow-up` tracker row. This queue prioritizes residual contracts that still need deterministic coverage: broader user flows, integration-specific fixture depth, and remaining reload/history parity gaps.
- Keep the user-realism rule: drive behavior through terminal input, slash commands, AIMock fixtures, deterministic pre-launch config/DB seeds, or approved external signal APIs for notification/state-signal origins. Do not emit Harness internals or mutate runtime display state directly.

## Priority queue

### 1. Tool rendering live-vs-history parity

- Completed: `tool-history-reload` seeds completed persisted `view`, `task_write`, and `web_search_20250305` messages into an isolated DB, opens `/threads`, and asserts reconstructed render matches live e2e expectations. This validates `Tools: Streaming tool arguments` and `Tools: Web search tool rendering`, and reduces the residual gaps for task tracking, harness display state, and workspace tools.
- Completed: `task-inline-transitions` uses AIMock tool-call fixtures for `task_write` → `task_complete` → clearing `task_write`, then asserts completed and cleared inline rendering in the live PTY TUI.
- Completed: `task-patch-tools` uses AIMock tool-call fixtures for `task_write` → `task_update` → `task_check`, then asserts patched pinned task state and rendered check output in the live PTY TUI.
- Completed: `task-prompt-context-next-turn` drives a live `task_write`, submits a later user prompt, and only matches the final AIMock fixture when the outbound system prompt contains the updated `<current-task-list>` ID and content.
- Completed: `workspace-tool-output-rendering` uses AIMock tool-call fixtures for live `execute_command` and `lsp_inspect`, writes a deterministic TypeScript file, and asserts visible shell stdout/footer plus LSP file/line/match rendering in the real PTY TUI.
- Completed: `workspace-plan-mode-tools` captures build-mode and plan-mode provider-visible tool dictionaries through real TUI prompts and proves plan mode removes workspace write/edit tools while preserving read/search/LSP tools.
- Completed: Harness display state is validated by core scheduler coalescing tests, focused TUI status-line routing coverage, live streamed-tool/task e2e scenarios, and loaded-history reconstruction coverage.
- Fixture/data needs: any remaining sanitized stored-message fixtures for edit/list and persisted shell breadth can be considered follow-up breadth, but the workspace-backed coding tools tracker row is validated.

### 2. Notification and state signals beyond first render

- Rows: `Chat: Notification inbox signals`, `Chat: Processor state signals`.
- Completed: `notification-inbox-tool-flow` sends a public medium-priority notification signal during an active run, renders the active summary card, then uses AIMock to call `notification_inbox read` and asserts the delivered details render in the same TUI thread.
- Completed: `notification-inbox-crud-flow` seeds deterministic notification records, uses AIMock to call `notification_inbox list`, `markSeen`, `dismiss`, `archive`, and `search`, and asserts list-only visibility plus searchable `seen`, `dismissed`, and `archived` status transitions in the real TUI.
- Completed: `notification-inbox-reload` seeds persisted notification and notification-summary signal DB messages, reloads them through `/threads`, and asserts loaded-history summary counts/hint plus dismissed, archived, and coalesced pending notification cards.
- Completed: `state-signal-reload` seeds a persisted state signal DB message, reloads it through `/threads`, and asserts loaded-history `State delta: browser` rendering with the persisted preview.
- Completed: `state-signal-browser-processor` attaches a deterministic browser provider to Mastra Code, lets `BrowserContextProcessor` emit live snapshot/delta signals during normal TUI turns, and proves browser state reaches AIMock request bodies; existing core processor tests cover evicted-snapshot refresh after pruning.
- Fixture/data needs: sanitized notification/state-signal DB rows; AIMock `notification_inbox` tool-call fixtures.

### 3. GitHub signals incremental flow

- Row: `Git: GitHub signal subscriptions`.
- Completed: `github-signals-incremental` seeds a persisted subscribed thread whose cursor last observed failing CI, points `MASTRACODE_GITCRAWL_BIN` at a deterministic recovered gitcrawl sqlite snapshot, runs `/github sync`, and asserts the `pull-request-ci-recovered` notification plus `/github debug` `ci=success` cursor update.
- Completed: `github-signals-unsubscribe-reload` opens a persisted subscribed thread, verifies `/github debug` shows the active subscription, runs `/github unsubscribe`, verifies debug state changes to no subscribed PRs, then reopens the thread through `/threads` to prove the empty subscription state reloads.
- Completed: `github-signals-polling-inbox` opens a persisted subscribed thread, triggers startup polling against a deterministic recovered-CI gitcrawl fixture, renders the delivered GitHub notification card, uses AIMock to call `notification_inbox read`, proves the DB status moves from `delivered` to `seen`, and verifies the subscribed thread appears after `/new` → `/threads` reload.
- Completed: `github-signals-notification-reload` seeds a persisted GitHub notification signal and subscribed-thread metadata, reloads through `/threads`, and asserts the loaded card source/kind/status/body plus status-line `PR#17641` projection.
- Fixture/data needs: sanitized sqlite fixture derived from `~/.config/gitcrawl/gitcrawl.db`; mock gitcrawl binary remains useful for non-hermetic multi-process polling breadth and branch auto-subscribe lifecycle coverage if those product surfaces are added.

### 3.5. Storage backend fallback/history parity

- Completed: `storage-fallback-history-reload` seeds persisted PostgreSQL settings with missing connection info plus local LibSQL history, verifies the visible fallback warning, loads the local history through `/threads`, and confirms saved settings still say `pg`.
- Completed: focused `storage-config.test.ts` coverage proves `getOmScope()` precedence for env, project/global database config, invalid values, and default `thread`.
- Deferred: real PostgreSQL success plus LibSQL↔PostgreSQL migration require external integration/smoke infrastructure or an unimplemented migration feature, so they are tracked as explicit non-hermetic follow-up rather than blocking the TUI recovery row.

### 4. MCP and browser integration depth

- Rows: `Integrations: MCP server configuration`, `MCP status and reload command`, `Browser automation`.
- Proposed scenarios:
  - Completed: `mcp-http-tool-call` launches a local Streamable HTTP MCP server before the TUI, requires configured request headers, asserts `/mcp status` shows a connected `[http]` server/tool, and uses AIMock to invoke the namespaced MCP tool through the real runtime.
  - Completed: `mcp-reload-config` starts from a project config-file stdio failure, rewrites `.mastracode/mcp.json` to a local header-protected HTTP server, runs `/mcp reload`, and asserts the new `[http]` server/tool status transition.
  - Completed: `mcp-selector-reconnect` starts with a failed HTTP MCP server, drives the interactive `/mcp` selector reconnect submenu until the server/tool row is connected, then rewrites project config and uses selector `r` reload-all to surface a second connected HTTP server/tool.
  - Completed: `mcp-skipped-validation` seeds invalid MCP config entries and verifies both `/mcp status` and the interactive selector render skipped validation reasons for ambiguous command+URL, malformed URL, invalid OAuth redirect, and missing-field servers.
  - Completed: `mcp-long-running-tool` launches a local Streamable HTTP MCP server with a delayed tool result, invokes it through AIMock, and proves the delayed payload reaches the model follow-up instead of timing out under a short result budget.
  - Completed: `headless-mcp-tool-availability` launches a delayed header-protected HTTP MCP server through global config, runs headless mode, and proves headless waits for MCP init so the namespaced tool result reaches the follow-up AIMock request.
  - Completed: focused `manager.test.ts` coverage proves MCP OAuth token storage uses a stable file-backed path across manager instances and preserves refreshed token replacements.
  - Completed: focused `mcp-selector.test.ts` coverage proves selector detail views, connecting-status polling, and stale reconnect result suppression while reload-all is in progress.
  - Completed: MCP server configuration row validated from existing deterministic stdio/HTTP/header/reload/selector/skipped/headless/OAuth-storage coverage; full protected OAuth authorization-server flow is deferred as future non-hermetic integration breadth.
  - Completed: `browser-wizard-export` drives the interactive `/browser` wizard through AgentBrowser/CDP selection, verifies saved settings and active status projection, then proves `/browser export storageState` writes deterministic storage-state contents.
  - Completed: `browser-wizard-browserbase` drives the interactive `/browser` wizard through Stagehand Browserbase selection, verifies Browserbase credential guidance, proves local launch/profile prompts are skipped, and catches stale CDP/profile/executable settings being cleared before persistence.
  - Completed: `browser-profile-provider-mismatch` drives the interactive `/browser` wizard through a Stagehand-marked profile reused by AgentBrowser, proves the mismatch confirmation gates persistence on `No`, and proves `Yes` rewrites the profile marker.
  - Completed: `browser-startup-restore` seeds enabled AgentBrowser/CDP settings before launch, verifies `/browser status` restores provider/headless/CDP projection without `/browser on`, and proves the first AIMock turn receives browser context plus browser tools.
  - Completed: `browserbase-startup-restore` seeds enabled Stagehand Browserbase settings before launch, verifies `/browser status` restores the Browserbase environment, then changes saved CDP settings without `/browser on` to prove startup active settings drive active-vs-pending status.
  - Completed: `browser-active-pending-status` seeds enabled AgentBrowser/CDP settings, changes saved CDP settings without `/browser on`, and proves `/browser status` renders active runtime settings separately from pending file settings plus apply guidance.
  - Completed: `browser-toggle-attach` seeds AgentBrowser CDP settings, drives `/browser on`, verifies enabled `/browser status` with the CDP endpoint, proves settings persisted, and uses AIMock request verification to confirm browser tools reached the next model turn.
- Fixture/data needs: local mock MCP server fixture; remaining OAuth breadth would need a deterministic protected-server/authorization fixture for failure-display coverage; no live browser credentials.

### 5. Settings and model UI breadth

- Rows: `Setup: Installation and launch`, `Setup: Auto-update prompts`, `Settings: Storage backend configuration`, `Settings: Quiet mode`, `Settings: Onboarding and global settings`, `Models: Custom OpenAI-compatible providers`, `Models: Provider history compatibility`, `Models: Stream error retry processor`.
- Proposed scenarios:
  - Completed: `setup-nested-model-selector` opens `/setup`, selects the custom model pack, enters a pack name, opens the nested model selector, cancels it with Escape, and asserts the parent setup overlay resumes without leaving the selector stuck.
  - Completed: `om-global-settings-persistence` creates an active thread, toggles `/om` caveman and attachment settings through the real overlay, then proves global settings and active-thread metadata projections update.
  - Completed: `setup-completion-persistence` seeds Memory Gateway provider access, steps `/setup` through OpenAI mode/OM pack selection and Disable YOLO, then proves completed/skipped state, pack IDs, YOLO, and built-in default persistence in `settings.json`.
  - Completed: `models-pack-activation-persistence` seeds a custom provider plus saved custom pack, activates it through `/models`, then proves active pack ID, custom mode defaults, stale subagent override cleanup, and custom pack retention in `settings.json`.
  - Completed: `api-key-delete-env` seeds a stored `302ai` API key alongside a real `302AI_API_KEY`, deletes the stored key through `/api-keys`, and proves the TUI falls back to env status while `auth.json` is cleared and the real env key remains intact.
  - Completed: `api-key-multi-provider-delete` seeds stored `302ai` and Anthropic keys, asserts the provider list is sorted with `302ai` before `anthropic`, deletes only the selected `302ai` key, and proves Anthropic auth/env projection remains intact while the deleted provider is cleared.
  - Completed: `settings-api-keys-navigation` opens `/settings`, selects the API Keys row, and proves the settings submenu hands off to the API-key management overlay.
  - Completed: `storage-settings` now proves the PostgreSQL connection string is masked while typed but persisted raw in `settings.json`, alongside the existing restart-required notice coverage.
  - Completed: focused `index.test.ts` coverage proves Memory Gateway startup hydrates `MASTRA_GATEWAY_API_KEY`/`MASTRA_GATEWAY_URL` from stored auth/settings before model access checks and authorizes gateway-backed providers.
  - Completed: `custom-provider-delete` seeds a custom OpenAI-compatible provider, deletes it through `/custom-providers`, confirms the destructive modal, and proves `settings.json` removes the provider while unrelated saved custom packs remain intact.
  - Completed: `model-selection-api-key-prompt` edits a saved custom pack through `/models`, selects a synthetic `302ai` model with no configured key, verifies the masked missing-key dialog/env hint, and proves stored auth/env projection plus saved pack settings update.
  - Completed: `model-selection-cancel-env` edits a saved custom pack through `/models`, selects a synthetic `302ai` model backed only by real `302AI_API_KEY` without prompting/storing, cancels a second missing-key prompt, and proves both selected model IDs persist while no auth keys are written.
  - Completed: `browser-settings-persistence` uses `/browser set`/`clear` quick commands to prove CDP/profile mutual exclusion, Stagehand profile preservation cleanup, executable-path persistence, and clear-all reset to default browser settings in `settings.json` without launching a live browser.
  - Completed: `custom-pack-import-overwrite` imports a shared `mastra-pack:` string through `/models`, confirms overwrite on a colliding saved pack, and proves imported model defaults plus active pack persistence in `settings.json`.
  - Completed: `custom-pack-rename-active` renames an active saved custom pack through `/models` Edit, saves it, and proves active/onboarding pack IDs migrate while the old pack entry is removed and model defaults remain intact.
  - Completed: `settings-startup-model-restore` seeds an active custom pack before launch, asserts the startup footer uses the persisted build model, and verifies `/models` still lists the saved pack plus persisted settings remain intact.
  - Completed: `setup-custom-pack-completion` walks `/setup` through Custom mode-pack creation, selects env-backed synthetic plan/build/fast models plus a custom OM model, disables YOLO, and proves custom pack/default/OM/subagent-cleanup persistence in `settings.json`.
  - Completed: `setup-login-refresh` starts first-run onboarding with no provider credentials, performs a deterministic Anthropic OAuth login, proves the setup wizard refreshes available mode/OM packs without restart, and verifies OAuth auth plus selected pack IDs persist.
  - Completed: `login-dialog-masked-input` drives `/login` into the Anthropic login dialog, proves the authorization-code prompt masks typed text, and verifies the raw code is still submitted into OAuth storage.
  - Completed: `om-pack-startup-restore` seeds a persisted built-in OpenAI OM pack before launch, verifies `/om` restores both observer and reflector models from the pack, and proves settings remain pack-backed rather than role-overridden.
  - Completed: `update-startup-prompt` boots with hermetic latest-version/changelog env overrides, asserts the automatic startup inline prompt/changelog, selects `No`, and proves `settings.updateDismissedVersion` persistence. Remaining breadth: dismissed-version startup suppression, passive recheck banner, and safe `Yes`/install success path.
  - Completed: `quiet-tool-history-parity` enables Quiet mode in settings, drives AIMock-backed live `view` + `task_write`, asserts compact tool/task rendering, then reloads a seeded tool-history thread and asserts loaded quiet compact rendering.
  - Completed: `storage-startup-pg-fallback` seeds persisted PostgreSQL backend settings before startup, verifies the missing-connection LibSQL fallback warning renders, and proves `settings.json.storage.backend=pg` remains persisted while the TUI stays usable. Remaining `settings-reload-persistence` breadth is cross-feature relaunch composition, not a distinct uncovered storage startup path; active custom model-pack startup restore is covered by `settings-startup-model-restore`, and `/om` threshold, built-in OM pack, plus role-model startup restore/global/thread persistence is covered by `om-threshold-persistence`, `om-pack-startup-restore`, and `om-model-override-reload`.
  - Completed: Settings umbrella validation now maps onboarding/global settings residual breadth to dedicated checked-in scenarios: setup/login/API-key/model-pack/custom-provider/OM/browser/storage/shell/subagent/Memory Gateway coverage lives in the narrower feature rows and scenario files, so no unique settings-umbrella gap remains.
  - Completed: `om-threshold-persistence` seeds global OM observation/reflection thresholds, verifies `/om` restores them on startup, updates both threshold submenus through the real TUI, and proves global settings plus active-thread metadata persist the new values.
  - Completed: `om-model-override-reload` seeds role-specific OM observer/reflector overrides, verifies `/om` restores them on startup, updates both model selectors through the real TUI, and proves global settings plus active-thread metadata persist the new role model IDs.
  - Completed: `subagent-model-startup-restore` seeds an active custom model pack before launch, delegates to the Explore subagent, verifies the subagent footer uses the restored fast model rather than the parent/build default, and proves persisted settings remain intact.
  - Completed: `custom-provider-edit-share-import` edits a provider name/URL/API key through `/custom-providers`, shares a saved custom pack to clipboard, cancels a colliding shared-pack import through `/models`, and proves settings only persist the completed provider edit.
  - Completed: `custom-pack-import-rename` imports a shared `mastra-pack:` string through `/models`, selects Rename on a colliding saved pack, and proves the original pack remains while the renamed imported pack becomes active. Remaining breadth: custom-pack completion, invalid provider URL/duplicate-name branches, remove-model, and selector persistence.
  - Completed: `custom-provider-model-selector` seeds a configured OpenAI-compatible provider, creates a `/models` custom pack from real catalog entries instead of the free-form `Use:` fallback, and proves active defaults plus saved pack models persist.
  - Completed: `custom-provider-modal-validation` creates a custom provider through `/custom-providers`, proves duplicate-name and invalid-URL modal validation, removes a provider model, and verifies persistence. Remaining live custom-provider request routing is covered below the TUI by provider routing tests rather than an additional row blocker.
  - Completed: `provider-history-rejection-retry` seeds invalid stored tool-call history, injects a one-shot provider 400, then proves `ProviderHistoryCompat` retries with a sanitized tool-call ID before the recovered AIMock response renders.
  - Completed: stream error retry processor row validated from `stream-error-retry` PTY recovery coverage plus focused core retry-decision tests and Mastra Code processor-order wiring tests; a real live OpenAI stream failure that distinguishes Mastra's processor from provider SDK retry remains deferred as non-hermetic provider behavior.
- Fixture/data needs: settings.json seeds, AIMock custom provider fixtures, one-shot local HTTP provider mock for rejection/retry cases.

### 6. Workspace, skills, hooks, and shell surfaces

- Completed: debug logging row validated with existing `debug-logging` PTY warning-capture coverage plus focused debug-log utility/startup-wiring tests for `main.ts` and `headless.ts`; long-session growth beyond startup cap is deferred as documented behavior.
- Completed: process suspend shortcut row validated from existing unit signal lifecycle coverage plus `process-shortcuts` PTY shortcut coverage; full shell `fg` resume remains deferred until a safe job-control primitive exists.
- Completed: shell passthrough row validated after `shell-passthrough-nonpersistent` proved local `!` output is neither persisted in `mastra_messages` nor forwarded to the next model request.

- Rows: `Skills command and workspace resolution`, `Lifecycle hooks`, `Shell passthrough streaming`, `Process suspend shortcut`, `File attachments in chat input`, `Observational memory`.
- Proposed scenarios:
  - Completed: lifecycle hooks row validated with existing `lifecycle-hooks-configured` PTY coverage for `/hooks` status/reload and `UserPromptSubmit` blocking plus focused `executor.test.ts` coverage for hook JSON protocol, timeout warning, blocking/non-blocking exit-code semantics, and context aggregation. Headless parity for TUI lifecycle-only hooks is deferred; supported headless tool hooks are covered by agent/tool tests.
  - Completed: `skills-command-activation` seeds deterministic workspace skills, asserts `/skills` lists only user-invocable skills, activates `/skill/<name>` with arguments and escaped embedded skill boundaries, and proves `/goal/<skill>` alias activation reaches AIMock.
  - Completed: `lifecycle-hooks-configured` starts from project hook config, verifies configured `/hooks` status, rewrites the config from disk, runs `/hooks reload`, then proves the reloaded `UserPromptSubmit` hook blocks a normal prompt before it reaches the agent.
  - Completed: `shell-passthrough-long-output` runs a slow multi-line `!` command, verifies output appears before process exit, asserts collapsed long-output rendering, then uses Ctrl+E to expand the tracked shell component.
  - Completed: `shell-passthrough-configured-settings` and `shell-passthrough-env-override` seed wrapper executables and prove persisted `settings.json.shellPassthrough` plus `MASTRACODE_SHELL`/`MASTRACODE_SHELL_MODE` env overrides drive the same visible local `!` command path.
  - Completed: `request-access-modal` uses an AIMock `request_access` tool call to an inaccessible path, asserts the real approval prompt, approves via Enter, renders the granted result, and reads a deterministic external file through `view` after the path is allowed.
  - Completed: `ask-user-advanced-prompts` uses AIMock `ask_user` calls to assert multiline free-text input, single-select `Custom response...` switching to typed input, and fixed-option multi-select toggling through the real PTY TUI.
  - Completed: `prompt-queue-interleave` uses simultaneous AIMock `ask_user` and `request_access` tool calls to assert the access prompt is queued behind the active ask_user prompt, activates after the first answer, accepts the default Yes option, and resolves the model turn.
  - Completed: `ctrlf-queued-image-followup` drives a real active run, pastes an image while the model is streaming, uses Ctrl+F to enqueue it, verifies `1 queued` status, waits for FIFO drain, and asserts the queued raw provider request contains the pasted PNG payload.
  - Completed: `ctrlf-queued-custom-slash` starts a slow active run, uses the real custom slash-command autocomplete to resolve `/queue-au` before Ctrl+F, verifies `//queue-auto` queues, and proves FIFO slash-command drain sends the processed custom-command payload to AIMock.
  - Completed: `autocomplete-wrapping-navigation` opens the real custom slash-command autocomplete with a long description, proves the wrapped continuation tail is visible at PTY width, presses one Down arrow, and verifies the selected second command reaches AIMock; focused queueing tests cover transient process-local queue cleanup/abort semantics, so queued-followups is validated.
  - Completed: strengthened `clipboard-image-paste` now drives a real bracketed-paste PNG through the TUI, asserts confirmed `[1 image]` history, and verifies the raw provider request contains the `image/png` file part plus base64 payload.
  - Completed: `file-attachment-history-reload` seeds persisted user signal history with projected text-file content, an image file part, and a binary file part, then proves `/threads` loaded history renders `[1 image] [1 file]` plus the text-file body without leaking raw base64.
  - Completed: `file-attachment-blocked-retry` uses a real `UserPromptSubmit` hook to block the first pasted-image submit, proves the editor restores `prompt [image]`, retries with Enter, and verifies the raw provider request still contains the PNG file payload exactly once.
  - Completed: `om-attachment-observation` drives a real pasted PNG through a multi-step TUI turn with OM enabled, hermetically stubs OpenAI attachment token counting, and verifies the OM observer request includes both the `[Image #1]` placeholder and raw `image/png` attachment data.
  - `om-background-recall`: seed sanitized observational memory, drive a prompt that recalls it, assert provenance/rendering.
- Fixture/data needs: deterministic skill/hook config files, AIMock tool-call fixtures, sanitized OM observations from local Application Support if needed.

## Suggested execution order

1. Tool history/reload parity, because the high-risk goal branches are now validated and live-vs-loaded rendering remains the broadest remaining gap.
2. Tool reload/history parity, because many partial rows share the same DB-seed fixture work.
3. Notification/state signal state transitions, because public signal APIs are already allowed but CRUD/reload parity is missing.
4. GitHub incremental mock-gitcrawl, because the binary override and sanitized sqlite fixture already exist.
5. MCP/settings/workspace breadth as smaller focused batches.

- ✅ `mastracode/src/tui/commands/__tests__/browser.test.ts` — covered richer `/browser status` active/pending projection for profile/executable/storage-state fields and storage-state-only drift detection. Breaks proved active storage rendering, pending executable rendering, and storage-state drift key participation.

- ✅ `custom-provider-modal-validation` — covers `/custom-providers` create-provider success, duplicate-name rejection, invalid URL rejection, and remove-model persistence through real PTY modal input; custom-provider row is validated with live external provider smoke deferred as non-hermetic breadth.
- ✅ `package-metadata.test.ts` — covers the built Mastra Code package `bin` entrypoint by running `--help` and the headless `--prompt` missing-settings validation path from `dist/cli.js`; installation/launch is validated with true global/npx install deferred as non-hermetic lifecycle breadth.
- ✅ `packages/core/src/harness/harness-public-api.test.ts` — compiles the live Harness reference MDX TypeScript example through the public `@mastra/core/harness` export and appends representative object-parameter calls; Harness API/reference-docs row is validated with redirects and explicit legacy positional-negative tests deferred.
- ✅ `skills-symlink-dedupe` — seeds visible and hidden Agent Skills spec `.agents/skills` symlinks, then proves `/skills` lists exactly one visible symlinked skill with description and keeps the non-invocable symlink hidden; skills-command row is validated with reload/staleness deferred until a product reload path exists.
- ✅ `commit-attribution-prompt` extension — drives a deterministic AIMock-authored `execute_command` git commit and verifies `git log -1 --format=%B` contains the selected-model `Co-Authored-By` footer; commit-attribution row is validated with arbitrary-model-output enforcement deferred as no current product surface.
- ✅ `subagent-plan-execute-tools` — delegates Plan and Execute through the real TUI, verifies completed footers, checks provider-visible tool boundaries, and confirms Execute writes project-visible file content; subagents row is validated with configured-ID restart override and audit-tests guidance breadth deferred.

