# Onboarding and global settings

## Origin PR / commit

- PR: [#13421](https://github.com/mastra-ai/mastra/pull/13421) — interactive first-run `/setup` flow, persisted global settings, built-in/custom model packs, OM packs, and YOLO preference.
- Later changes: [#13431](https://github.com/mastra-ai/mastra/pull/13431) — temporarily changed Codex defaults; current source now uses OpenAI `gpt-5.5` defaults; [#13435](https://github.com/mastra-ai/mastra/pull/13435) — added persisted storage backend settings for LibSQL/PostgreSQL; [#13487](https://github.com/mastra-ai/mastra/pull/13487) — added persisted theme preference; [#13494](https://github.com/mastra-ai/mastra/pull/13494) — fixed the supported-providers documentation URL in onboarding; [#13500](https://github.com/mastra-ai/mastra/pull/13500) — allows onboarding to proceed with API-key-only provider access instead of requiring OAuth/built-in packs; [#13505](https://github.com/mastra-ai/mastra/pull/13505) / [#13508](https://github.com/mastra-ai/mastra/pull/13508) — added and then strengthened an Anthropic OAuth warning, but current source has removed that flow via later #14605; [#13512](https://github.com/mastra-ai/mastra/pull/13512) — made `/models` the single pack flow and hardened custom pack settings updates; [#13566](https://github.com/mastra-ai/mastra/pull/13566) — expands provider access detection to all registry provider API-key env vars; [#13682](https://github.com/mastra-ai/mastra/pull/13682) — persists custom OpenAI-compatible providers in settings; [#13603](https://github.com/mastra-ai/mastra/pull/13603) — persists dismissed auto-update prompt versions in settings; [#13748](https://github.com/mastra-ai/mastra/pull/13748) — persists thinking-level changes from `/think`, `/settings`, and model-pack auto-bumps; [#13611](https://github.com/mastra-ai/mastra/pull/13611) — initializes shared provider auth storage and loads stored API keys into env before model/auth access checks; [#13953](https://github.com/mastra-ai/mastra/pull/13953) — persists/restores the OM observe-attachments preference (`auto`/on/off) through settings and thread metadata; [#13573](https://github.com/mastra-ai/mastra/pull/13573) — stores provider API keys collected by model-selection prompts and reloads them into env on startup without overriding real env vars; [#14604](https://github.com/mastra-ai/mastra/pull/14604) — updates built-in OpenAI mode/OM pack defaults; [#14605](https://github.com/mastra-ai/mastra/pull/14605) — removes the Claude Max OAuth warning acknowledgement field and modal flow from onboarding/login settings; [#14788](https://github.com/mastra-ai/mastra/pull/14788) — persists OM observation/reflection threshold defaults in global settings so new threads inherit the last `/om` history-size values; [#14952](https://github.com/mastra-ai/mastra/pull/14952) — persists the Memory Gateway base URL in global settings and stores its API key through AuthStorage/env; [#14936](https://github.com/mastra-ai/mastra/pull/14936) — masks sensitive settings/login/API-key input fields in TUI dialogs; [#15036](https://github.com/mastra-ai/mastra/pull/15036) — persists browser automation provider/profile/runtime settings and restores enabled browsers at startup; [#15014](https://github.com/mastra-ai/mastra/pull/15014) — adds `/api-keys` and a Settings submenu entry for provider API-key management; [#15194](https://github.com/mastra-ai/mastra/pull/15194) — adds browser `profile` and `executablePath` launch options plus profile lock cleanup; [#15359](https://github.com/mastra-ai/mastra/pull/15359) — persists OM caveman-observation mode in global settings and mirrors it through thread metadata; [#16274](https://github.com/mastra-ai/mastra/pull/16274) — standardizes setup/config prompts as modal overlays; [#16682](https://github.com/mastra-ai/mastra/pull/16682) — persists `/om` Observe Attachments Auto/On/Off globally and restores/seeds the per-thread harness state; [#16771](https://github.com/mastra-ai/mastra/pull/16771) — adds quiet-mode rollout/preference persistence and preview-line caps; [#16669](https://github.com/mastra-ai/mastra/pull/16669) — persists signal transport flags including Unix socket PubSub; [#13751](https://github.com/mastra-ai/mastra/pull/13751) — adds a programmatic `configDir` option that is tracked in Mastra Code state while leaving `settings.json` preferences separate; [#17283](https://github.com/mastra-ai/mastra/pull/17283) — persists direct TUI shell passthrough settings (`mode`, `executable`, `family`) for `!` commands; [#17447](https://github.com/mastra-ai/mastra/pull/17447) — persists the experimental GitHub Signals setting for PR subscription polling.

## User-visible behavior

- What the user can do: complete first-run setup or re-run `/setup`; use OAuth or configured API keys; manage stored provider keys from `/api-keys`/Settings; choose mode model pack, OM pack, YOLO default, quiet-mode preference/preview lines, browser automation settings, direct shell passthrough settings for `!` commands, experimental GitHub Signals, OM caveman-observation mode, OM attachment-observation mode, and Memory Gateway base URL/API key.
- Success looks like: selected pack updates current run, thread metadata, global settings, subagent defaults, browser defaults, OM models/threshold/caveman defaults, Memory Gateway settings, and status line; API-key-only providers, including stored keys and non-hardcoded registry providers, do not get blocked at the auth step; OpenAI defaults resolve to the current pack IDs.
- Must preserve: skipped/completed onboarding state, active model/OM pack IDs, custom packs, provider access detection, stored-key env precedence, YOLO preference, browser settings, shell passthrough defaults, OM observe-attachments/threshold/caveman settings, masked sensitive settings prompts, removed Claude Max warning state, and settings migrations.

## Entry points / commands

- Commands / shortcuts / flags: `/setup`, `/models`, `/theme`, provider login prompts.
- Automatic triggers: startup shows onboarding when settings have neither completed nor skipped the current onboarding version.

## TUI states

- Idle: setup wizard renders as modal overlay; `/models` opens model-pack switcher/import/edit flow.
- Active / modal / error: onboarding and setup/config dialogs use shared modal overlay sizing/padding; onboarding can launch login, refresh available packs after login, show API-key docs/copy when no provider access is detected, prompt/store API keys during model selection, or be cancelled/skipped.
- Historical note: Anthropic OAuth warning modals from #13505/#13508 are not active in current source; current login/setup flows go straight through auth mode + login dialog. The #13508 warning specifically strengthened the now-removed copy to mention reported bans and Terms of Service risk.

## Headless / non-TUI behavior

- Supported: startup reads `settings.json` for model defaults, OM defaults, YOLO, thinking level, browser/storage/signal/shell passthrough settings, and custom providers.
- Not supported / unknown: no interactive onboarding in headless; settings must already exist or defaults apply.

## Streaming / loading / interrupted states

- Streaming / loading: setup is a pre-run/idle overlay, not a streamed assistant message.
- Abort / retry / resume: cancellation records skipped state only for first-time onboarding; completed setup persists immediately through `saveSettings()`.

## Streaming vs loaded-from-history behavior

- While actively streaming: selected pack changes apply to the live harness session via `switchModel`, per-mode thread settings, subagent model IDs, OM state, and YOLO state.
- After reload / history reconstruction: `createMastraCode()` resolves global settings into mode defaults, OM models, subagent defaults, and initial state before session prefill.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Onboarding completion/skipped/version | `settings.json` onboarding section | Startup gating, `/setup` previous selections |
| Active model pack | Thread setting `activeModelPackId` + global settings fallback + built-in pack definitions (`openai/gpt-5.5` build/plan, `openai/gpt-5.4-mini` fast in current source) | `/models`, startup default resolution, footer/runtime model state |
| Custom model packs | `settings.json` `customModelPacks` plus thread active pack metadata | `/setup`, `/models` create/edit/import/share/delete, startup `resolveModelDefaults()` |
| Provider access | Shared AuthStorage + env/API-key detection + stored `apikey:<provider>` entries + provider registry `apiKeyEnvVar`; no persisted Claude Max warning acknowledgement in current schema | Onboarding auth gate, `/api-keys`, pack filtering, model prompts, provider-specific OAuth modules |
| Custom providers | `settings.json` `customProviders` | `/custom-providers`, model resolver, custom catalog |
| OM pack/model/attachment observation/threshold/caveman defaults | Harness state + global settings OM fields (`omObservationThreshold`, `omReflectionThreshold`, `omCavemanObservations`, `omObserveAttachments`) + thread metadata | OM memory factory, `/om`, setup wizard, observer attachment filter, startup/thread restore initial state |
| YOLO/quiet/thinking preferences | Harness state + global settings preferences + quiet rollout flag and preview-line cap | Permission prompts, quiet rollout modal, tool/task/subagent rendering, `/settings`, `/think` |
| Signal transport settings | Global settings `signals` block (`unixSocketPubSub`, `experimentalGithubSignals`) plus optional `MastraCodeConfig` overrides | `createMastraCode()` signal PubSub selection, cross-process PubSub/thread-lock behavior, GitHub signal processor/polling/subscriptions |
| Shell passthrough settings | Global settings `shellPassthrough` block (`mode`, `executable`, `family`); env vars can override at runtime | `handleShellPassthrough()`, `resolveShellPassthroughInvocation()`, `/help` shell label |
| Runtime config directory | `MastraCodeConfig.configDir` persisted into `MastraCodeState.configDir` | Project/global path lookup for MCP, hooks, commands, skills, storage, resource-id override, and static instructions |
| Storage backend | Global settings + env overrides; connection-string prompt uses `MaskedInput` | Storage factory, memory/history persistence |
| Browser automation settings | Global settings `browser` block parsed by `parseBrowserSettings()` including `profile`, `executablePath`, CDP, scope, and provider-specific subsettings | `/browser`, startup `createBrowserFromSettings()`, Harness browser state |
| Memory Gateway settings | Global settings `memoryGateway.baseUrl` + AuthStorage `apikey:mastra-gateway` / `MASTRA_GATEWAY_API_KEY` and `MASTRA_GATEWAY_URL` env | `/memory-gateway`, model resolver, server gateway-memory proxy |
| Theme preference | Global settings + `MASTRA_THEME` env override | Startup detection, `/theme`, TUI colors |
| Dismissed update version | `settings.json` `updateDismissedVersion` | Startup auto-update prompt and manual update command |

## Key files

- `mastracode/src/onboarding/onboarding-inline.ts` — setup wizard UI, API-key/OAuth copy, step flow, and supported-provider docs link.
- `mastracode/src/onboarding/settings.ts` — `settings.json` schema, migrations, defaults, OM threshold/caveman defaults, signal flags including `experimentalGithubSignals`, shell passthrough defaults/parsing, pack resolution, and custom provider parsing.
- `mastracode/src/onboarding/packs.ts` — provider-filtered built-in mode/OM packs (including current OpenAI defaults) plus always-available custom packs.
- `mastracode/src/tui/mastra-tui.ts` — startup onboarding trigger, quiet-mode preference prompt, runtime provider access refresh, auto-update prompt checks, modal setup rendering, and `applyOnboardingResult()` runtime persistence.
- `mastracode/src/tui/overlay.ts` and `modal-question.ts` — shared modal overlay sizing/padding and config question helper used by setup/config commands.
- `mastracode/src/tui/commands/models-pack.ts` — `/models` pack switch/custom/edit/share/import behavior and missing-key prompt trigger.
- `mastracode/src/tui/prompt-api-key.ts`, `components/api-key-dialog.ts`, `components/masked-input.ts`, and `commands/api-keys.ts` — model-selection API-key prompt, masked key entry, and stored-key management.
- `mastracode/src/tui/commands/om.ts` and `mastracode/src/agents/thread-caveman-state.ts` — `/om` writes global/thread OM settings and startup/thread changes mirror or seed caveman/attachment metadata.
- `mastracode/src/tui/commands/memory-gateway.ts` — Memory Gateway API-key/base-URL settings flow.
- `mastracode/src/tui/components/settings.ts` — storage backend settings, API Keys submenu entry, and masked connection-string input.
- `mastracode/src/tui/commands/browser.ts` — `/browser` command settings wizard and quick updates.
- `mastracode/src/index.ts` — startup resolution of settings into Harness modes, registry provider API-key access, stored API-key env loading, OM state, thresholds, `observeAttachments`, subagents, storage, browser, memory gateway, preferences, and custom configDir state.
- `mastracode/src/auth/storage.ts` — provider post-login default model IDs plus stored API-key helpers; current source has no Claude Max warning storage helpers.
- `mastracode/src/tui/commands/login.ts` — current login flow goes directly through auth mode/provider dialogs without the removed warning overlay.

## Dependencies / related features

- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — mode model defaults and auth checks.
- [Custom OpenAI-compatible providers](../models/custom-providers.md) — custom providers are persisted in the same global settings file.
- [Observational memory](../memory/observational-memory.md) — setup selects default OM model pack and `/om` writes global threshold/caveman defaults in the same settings file.
- [Persistent conversations](../threads/persistent-conversations.md) — per-thread model-pack metadata overrides global defaults.
- [Storage backend configuration](./storage-backend.md) — storage backend choice is persisted in the same global settings file.
- [Browser automation](../integrations/browser-automation.md) — browser provider/profile/runtime settings are persisted in global settings.
- [Terminal theme and contrast](../tui/terminal-theme.md) — theme preference is persisted in global settings.
- [Auto-update prompts](../setup/auto-update-prompts.md) — dismissed update versions are persisted in global settings.
- [Quiet mode](../tui/quiet-mode.md) — quiet preferences and rollout state are persisted in global settings.
- [GitHub signal subscriptions](../git/github-signal-subscriptions.md) — experimental GitHub Signals are toggled through persisted signal settings.
- [Custom config directory](./custom-config-directory.md) — configDir controls project/global config file lookup but is not an interactive settings preference.
- [Shell passthrough streaming](../tui/shell-passthrough.md) — `settings.shellPassthrough` configures the local `!` command runner.

## Existing tests

- `mastracode/src/onboarding/__tests__/settings.test.ts` — settings parsing, migrations, pack resolution, thread active pack inference, quiet-mode defaults/rollout, signal settings, shell passthrough parsing, and preview-line normalization.
- `mastracode/src/__tests__/index.test.ts` — startup settings plumbing, stored API-key env loading, registry provider API-key access with multi-env `apiKeyEnvVar` entries, caveman startup restore, `observeAttachments` default/restore behavior, and GitHubSignals processor wiring are partially mocked.
- `mastracode/src/onboarding/__tests__/packs.test.ts` — provider-gated built-in packs, current OpenAI/GitHub defaults, and API-key/OAuth pack visibility inputs.
- `mastracode/src/tui/commands/__tests__/models-pack.test.ts` — custom pack upsert/remove/rename/edit/share/import helpers.
- `packages/core/src/harness/om-threshold-persistence.test.ts` — thread-level OM threshold restore/backfill behavior for state seeded from global settings.
- `mastracode/src/agents/thread-caveman-state.test.ts` — thread metadata mirror/seed behavior for `cavemanObservations` and `observeAttachments`.
- `mastracode/src/tui/commands/__tests__/memory-gateway.test.ts` — Memory Gateway base-URL and stored-key settings flow.
- `packages/core/src/agent/__tests__/browser.test.ts` and `packages/core/src/browser/browser.test.ts` — core browser context/session and profile cleanup behavior.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — mocks `/api-keys` slash-command routing.
- `mastracode/scripts/mc-e2e/scenarios/api-key-prompt.ts` — partial real PTY coverage for `/api-keys`: provider status list, masked add-key dialog, stored-key persistence, and refreshed stored status.
- `mastracode/scripts/mc-e2e/scenarios/api-key-delete-env.ts` — partial real PTY coverage for `/api-keys` delete/env precedence: starts with both a stored `302ai` key and a real `302AI_API_KEY`, removes the stored key via Delete, verifies the UI falls back to env status/detail copy, and proves `auth.json` is cleared while the shell env key remains intact.
- `mastracode/scripts/mc-e2e/scenarios/om-global-settings-persistence.ts` — partial real PTY coverage for `/om`: creates an AIMock-backed active thread, toggles caveman observations and attachment forwarding through the OM settings overlay, then verifies `settings.json` global defaults and active-thread metadata keys through shell passthrough.
- `mastracode/scripts/mc-e2e/scenarios/om-threshold-persistence.ts` — partial real PTY coverage for `/om` threshold restore/persistence: seeds global observation/reflection thresholds before startup, verifies `/om` restores 12k/80k from settings, updates them to 15k/60k through the threshold submenus, then proves global settings, status footer state, and active-thread metadata persist the new values.
- `mastracode/scripts/mc-e2e/scenarios/setup-completion-persistence.ts` — partial real PTY coverage for `/setup`: seeds deterministic Memory Gateway provider access, walks Welcome → auth skip → OpenAI mode pack → OpenAI Mini OM pack → Disable YOLO, then verifies onboarding completion, mode/OM pack IDs, YOLO preference, skipped-state cleanup, and built-in-pack defaults in `settings.json` through shell passthrough.
- `mastracode/scripts/mc-e2e/scenarios/setup-custom-pack-completion.ts` — partial real PTY coverage for `/setup` custom-pack completion: selects a custom mode pack, picks synthetic env-backed `302ai` models for plan/build/fast plus custom OM, disables YOLO, then proves the saved custom pack, mode defaults, active/onboarding IDs, custom OM override, stale subagent override cleanup, and YOLO persistence.
- `mastracode/scripts/mc-e2e/scenarios/setup-login-refresh.ts` — partial real PTY coverage for `/setup` login refresh: starts first-run onboarding with no provider credentials, completes a deterministic Anthropic OAuth login, verifies refreshed mode/OM pack lists expose Anthropic without restart, and proves OAuth auth plus selected pack IDs persist in settings.
- `mastracode/scripts/mc-e2e/scenarios/models-pack-activation-persistence.ts` — partial real PTY coverage for `/models`: seeds a custom OpenAI-compatible provider plus saved custom pack, activates the pack through the real switch/custom-pack action overlay, then verifies `settings.json` active pack ID, custom mode defaults, stale subagent override cleanup, and saved custom pack retention through shell passthrough.
- `mastracode/scripts/mc-e2e/scenarios/custom-provider-delete.ts` — partial real PTY coverage for `/custom-providers`: seeds a custom OpenAI-compatible provider, deletes it through the manage-provider modal and destructive confirmation, then verifies `settings.json` no longer contains the provider while unrelated saved custom packs remain intact.
- `mastracode/scripts/mc-e2e/scenarios/model-selection-api-key-prompt.ts` — partial real PTY coverage for model-selection-triggered API-key prompts: edits a saved custom pack through `/models`, selects a synthetic `302ai` model without a configured key, verifies the masked `API Key Required` dialog with env-var hint, then proves `auth.json`, `process.env`, and saved pack settings update after submit.
- `mastracode/scripts/mc-e2e/scenarios/model-selection-cancel-env.ts` — partial real PTY coverage for model-selection env precedence and cancellation: edits a saved custom pack, selects a synthetic `302ai` model backed only by real `302AI_API_KEY` without prompting/storing, cancels a missing-key prompt for a second synthetic provider, and proves both selected model IDs persist while no auth keys are written.
- `mastracode/scripts/mc-e2e/scenarios/browser-settings-persistence.ts` — partial real PTY coverage for `/browser set`/`clear`: sets CDP URL, switches to a profile and proves CDP is cleared while profile preservation is enabled, sets a custom executable path, clears the profile, and proves `settings.json` retains the executable path while clearing profile/CDP/preserve state.
- `mastracode/scripts/mc-e2e/scenarios/browser-startup-restore.ts` — partial real PTY startup coverage for persisted enabled browser settings: seeds AgentBrowser/CDP settings before launch, verifies `/browser status` restores provider/headless/CDP projection without `/browser on`, and proves the first AIMock-backed model turn receives browser context plus provider-visible browser tools.
- `mastracode/scripts/mc-e2e/scenarios/custom-pack-import-overwrite.ts` — partial real PTY coverage for `/models` shared-pack import: seeds a colliding saved custom pack, imports a `mastra-pack:` string through the modal flow, confirms overwrite, and proves the imported pack/defaults/active pack ID persist in `settings.json`.
- `mastracode/scripts/mc-e2e/scenarios/custom-pack-import-rename.ts` — partial real PTY coverage for `/models` shared-pack import collision rename: selects Rename on a colliding import, enters a new pack name, and proves both the original pack and renamed imported pack persist while the renamed pack is active.
- `mastracode/scripts/mc-e2e/scenarios/custom-pack-rename-active.ts` — partial real PTY coverage for `/models` targeted custom-pack edit: renames an active saved custom pack through the Edit overlay, saves it, and proves `settings.json` migrates active/onboarding pack IDs while removing the old pack name and preserving model defaults.
- `mastracode/scripts/mc-e2e/scenarios/settings-startup-model-restore.ts` — partial real PTY startup/reload coverage: seeds an active custom model pack before launch, verifies the initial status footer boots with the persisted build model, opens `/models` to prove the saved pack is selectable with its model details, and checks the persisted settings remain intact.
- `mastracode/scripts/mc-e2e/scenarios/subagent-model-startup-restore.ts` — partial real PTY startup/reload coverage for model-pack-backed subagent defaults: seeds an active custom model pack before launch, delegates to the Explore subagent, verifies the real subagent runner uses the restored fast model, and proves persisted settings remain intact.
- `mastracode/scripts/mc-e2e/scenarios/custom-provider-edit-share-import.ts` — partial real PTY coverage for custom provider edit plus `/models` share/import-cancel: shares a saved pack to the clipboard and decodes the `mastra-pack:` payload, cancels a colliding import without activating it, edits a provider name/URL/API key, and proves persisted settings reflect only the completed edit.

## Missing tests

- First-run onboarding wizard breadth for login refresh is covered by `setup-login-refresh`; built-in OpenAI mode/OM pack completion, custom-pack completion, YOLO persistence, skipped-state cleanup, and persisted setup settings are covered by `setup-completion-persistence` and `setup-custom-pack-completion`. Remaining first-run breadth is browser/settings wizard variants rather than login refresh.
- Reload after `/setup`: active custom pack startup footer restoration is covered by `settings-startup-model-restore`; model-pack-backed Explore subagent default restoration is covered by `subagent-model-startup-restore`; `/om` threshold startup restore and role-specific observer/reflector model override reload are covered by `om-threshold-persistence` and `om-model-override-reload`; remaining OM model-pack defaults still need reload parity.
- Direct Mastra Code `/om` observer/reflector model override regression is covered by `om-model-override-reload`; threshold restore/persistence is covered by `om-threshold-persistence`, and caveman/observe-attachments global/thread persistence is covered by real PTY e2e.
- `/models` custom-pack completion breadth through real TUI overlay remains; activation and persisted custom-pack defaults are covered by `models-pack-activation-persistence`, import collision overwrite/rename are covered by `custom-pack-import-overwrite` and `custom-pack-import-rename`, targeted active-pack rename/edit is covered by `custom-pack-rename-active`, share payload plus import-cancel collision routing are covered by `custom-provider-edit-share-import`, and provider deletion persistence is covered by `custom-provider-delete`.
- Missing-key model-selection submit/cancel/env-precedence breadth through real TUI overlay is now covered by `model-selection-api-key-prompt` and `model-selection-cancel-env`; direct `/api-keys` add/delete e2e covers explicit API-key management. Remaining model-selection breadth is provider-history ranking/reuse outside the settings row.
- Direct MaskedInput regression for storage connection strings and login dialogs proving render output is masked while submitted value remains raw; `/api-keys` masked input is covered by real PTY e2e.
- Headless startup with browser settings and Memory Gateway base URL/env values; active custom model pack startup restoration is covered by `settings-startup-model-restore`, and TUI startup restore for enabled AgentBrowser/CDP settings is covered by `browser-startup-restore`.
- Direct `/browser` settings breadth for full wizard save/export remains; quick-command profile/CDP mutual exclusion, custom executable persistence, and profile clear cleanup are covered by `browser-settings-persistence`, and startup attach/status/tool injection is covered by `browser-startup-restore`.
- Direct `/api-keys` settings submenu breadth for provider ordering and multi-provider delete flows; add/storage plus stored-key delete with real-env preservation are covered by real PTY e2e.

## Known risks / regressions

- State is split across live harness session, thread metadata, global settings, auth storage, and UI projections; OM threshold and caveman defaults intentionally have both per-thread and global-default owners.
- Provider access can be true from API keys even when no non-custom built-in mode pack is available; onboarding must use the explicit `hasProviderAccess` flag, not infer from pack count.
- Provider registry API-key detection can drift between startup, setup, `/models`, and runtime model resolution, especially for providers with multiple env var names.
- Stored API keys are loaded into `process.env` only when no real env var exists; tests need isolated env to avoid false provider-access positives. Memory Gateway has both AuthStorage key and URL/env state, so tests must isolate both `MASTRA_GATEWAY_API_KEY` and `MASTRA_GATEWAY_URL`.
- Built-in pack model IDs drift over time; current source uses OpenAI `gpt-5.5` build/plan and `gpt-5.4-mini` fast/OM even though #13431 temporarily lowered Codex defaults.
- Earlier Slack regression around “No model selected” after reload likely lives near this settings/session boundary.
- Custom pack rename/delete/import can leave stale global or thread pack IDs if cleanup misses one ownership layer.
- Browser settings include full persisted fields that are not all mirrored into `activeBrowserSettings`; status/config-drift checks must not treat the state projection as the full source of truth.
- `/api-keys` mutates both AuthStorage and env-backed runtime state; delete flows must avoid removing real shell env credentials while still clearing stored-key projections.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
