# Mastra Code testing recovery history

### Process suspend shortcut validation (2026-06-13, pending)

Validated the process suspend shortcut row from existing deterministic coverage. `process-shortcuts` exercises the real PTY visible surface by opening `/help`, asserting the Ctrl+Z suspend and Alt+Z undo shortcut copy, clearing a draft with Ctrl+C, and restoring it with Alt+Z. Unit coverage in `custom-editor.test.ts` proves Ctrl+Z and Alt+Z route to separate editor actions without falling through. Unit coverage in `setup-keyboard-shortcuts.test.ts` proves the suspend handler stops the UI, registers a `SIGCONT` listener, sends `SIGTSTP`, restarts rendering on continue, guards Windows, recovers when `process.kill()` throws, and owns Alt+Z restore semantics.

No new test was added: the remaining shell-level `fg` resume flow is intentionally deferred until the TUI test runner exposes a safe job-control primitive. Driving a real `SIGTSTP` inside the worker is non-hermetic and can strand the terminal/process.

Existing break evidence:

1. Routing Ctrl+Z to `undo` made focused editor routing tests fail.
2. Removing `SIGCONT` registration made focused keyboard shortcut tests fail.
3. Removing the Windows guard made focused keyboard shortcut tests fail.
4. Changing the Ctrl+Z help description made `process-shortcuts` fail waiting for `Suspend process (fg to resume)`.
5. Remapping undo from Alt+Z to Alt+X made `process-shortcuts` fail waiting for the restored draft.
6. Stopping Ctrl+C from saving `lastClearedText` made Alt+Z fail to restore the cleared draft.

Verification to rerun for this row:

```sh
pnpm --filter ./mastracode exec vitest --run src/tui/__tests__/setup-keyboard-shortcuts.test.ts src/tui/components/__tests__/custom-editor.test.ts --bail=1 --reporter=dot
pnpm --filter ./mastracode run e2e:test process-shortcuts
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
pnpm run build:mastracode
```

### Debug logging startup wiring coverage (2026-06-13, 078a091149)

Extended `mastracode/src/utils/__tests__/debug-log.test.ts` with startup-wiring assertions that both production entrypoints, `src/main.ts` and `src/headless.ts`, import and call `setupDebugLogging()` exactly once. Existing debug-log unit coverage already protects env gating, warning/error redirection, stack formatting, startup truncation, append behavior, and repeated setup behavior. Existing `debug-logging` PTY e2e verifies an opt-in `MASTRA_DEBUG=1` run captures a sentinel warning into isolated app-data `debug.log` without leaking it into the terminal UI.

Break validations:

1. Removed the `setupDebugLogging()` call from `main.ts`; the focused test failed for `src/main.ts`.
2. Removed the `setupDebugLogging()` call from `headless.ts`; the focused test failed for `src/headless.ts`.
3. Duplicated the `setupDebugLogging()` call in `main.ts`; the focused test failed because the call count was 2 instead of 1.

All breaks were reverted and the focused test passed cleanly. Long-session log growth beyond the startup cap remains documented behavior rather than a deterministic recovery blocker.

Verification:

```sh
pnpm --filter ./mastracode test --run src/utils/__tests__/debug-log.test.ts --reporter=dot --bail 1
pnpm run build:mastracode
pnpm --filter ./mastracode run e2e:test debug-logging
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
```

### Lifecycle hook executor coverage (2026-06-13, 9acae8d4bd)

Added `mastracode/src/hooks/executor.test.ts`, a focused shield for the remaining lifecycle hook executor protocol breadth: command hooks receive JSON stdin plus `MASTRA_HOOK_EVENT`, JSON stdout is parsed into additional context, hung hooks are killed and reported as timeout warnings, blocking events stop on exit code 2 with the parsed reason, non-blocking events convert exit code 2 into warnings, and accumulated additional context is preserved. Existing PTY e2e already covers configured `/hooks` status, `/hooks reload`, and `UserPromptSubmit` blocking through the real terminal. Existing TUI hook unit tests cover Stop reasons, SessionEnd on `stop()`, and caffeinate cleanup.

Break validations:

1. Disabled JSON stdout parsing in `executeHook`; the focused test failed because parsed `additionalContext` was missing.
2. Disabled timeout marking before killing a hung hook; the focused test failed because the result was not marked timed out and no timeout warning was produced.
3. Ignored blocking exit-code-2 handling; the focused test failed because a blocking `UserPromptSubmit` hook was allowed.

All breaks were reverted and the focused test passed cleanly. Headless parity for TUI lifecycle-only hooks remains explicitly deferred as a product-surface decision; headless-supported tool hooks are covered by agent/tool tests.

Verification:

```sh
pnpm --filter ./mastracode test --run src/hooks/executor.test.ts --reporter=dot --bail 1
pnpm run build:mastracode
pnpm --filter ./mastracode run e2e:test lifecycle-hooks-configured
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
```

### Stream error retry processor deterministic validation (2026-06-13, 210bb1e349)

Validated the stream error retry processor row from existing checked-in deterministic coverage: `packages/core/src/processors/stream-error-retry-processor.test.ts` proves retryable provider metadata, cause-chain traversal, OpenAI Responses stream `error`/`response.failed` matching, custom matcher extensibility, non-retryable rejection, and `maxRetries`; `mastracode/src/__tests__/index.test.ts` proves Mastra Code wires `StreamErrorRetryProcessor` before `PrefillErrorHandler` and `ProviderHistoryCompat`; `stream-error-retry` drives a real PTY TUI run that injects a retryable stream-event failure and completes through AIMock with the recovered response.

No new runtime code or tests were added in this chunk. The remaining card items are explicitly deferred: a real OpenAI Responses stream failure that proves Mastra's processor, rather than provider SDK retry behavior, performed the retry is non-hermetic; a TUI/headless visible retry indicator is not currently a product surface.

Verification:

```sh
pnpm run build:mastracode
pnpm --filter ./packages/core exec vitest run src/processors/stream-error-retry-processor.test.ts --reporter=dot --bail 1
pnpm --filter ./mastracode exec vitest run src/__tests__/index.test.ts --reporter=dot --bail 1
pnpm --filter ./mastracode run e2e:test stream-error-retry
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
```

### MCP server configuration deterministic validation (2026-06-13, `17f941e1e9`)

Validated the MCP server configuration row from existing checked-in deterministic coverage: config parsing/validation including OAuth redirect and scopes, `createMastraCode({ mcpServers })` startup wiring, manager HTTP URL/header/OAuth provider construction, durable OAuth token storage and refresh replacement, programmatic/file precedence, PTY stdio config failure display, header-protected HTTP tool execution, project config reload, selector reconnect/reload-all, skipped validation display, delayed long-running MCP tools, and headless HTTP MCP availability.

No new code or tests were added in this chunk. The only remaining card item is a full protected HTTP OAuth authorization/failure-display flow against a real authorization server. That requires a future deterministic protected-server integration fixture and is explicitly deferred as non-hermetic breadth rather than blocking deterministic recovery validation.

Verification:

```sh
git status --short --branch
# branch was clean/synced before docs-only validation
```
### MCP selector focused coverage (2026-06-13, `9e3fe22871`)

Added `mastracode/src/tui/components/__tests__/mcp-selector.test.ts`, a focused component shield for the residual MCP status/reload row breadth: connected server tool/log detail views, failed-server error detail, connecting-status polling until settled, and stale reconnect result suppression while reload-all is in progress. Existing PTY e2e already covers `/mcp status`, HTTP manager/tool availability, `/mcp reload`, selector reconnect/reload-all, skipped validation, delayed MCP tool completion, and headless MCP availability.

Break validations:

1. Removed tool names from the selector detail view; the focused test failed waiting for `alpha_search`/`alpha_write`.
2. Disabled polling status refresh; the focused test failed because the server stayed `connecting...` instead of rendering the connected tool row.
3. Removed stale reconnect suppression during reload-all; the focused test failed because the stale reconnect failure leaked into `showInfo`.

All breaks were reverted and the focused test passed cleanly. The MCP status/reload row moved to validated; protected OAuth authorization-display breadth remains non-blocking integration follow-up.

Verification:

```sh
pnpm run build:mastracode
pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/mcp-selector.test.ts --reporter=dot --bail 1
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
```

Full PTY e2e was not rerun for this chunk because no runtime/e2e code changed; the row is validated by existing checked-in PTY e2e coverage plus this focused component shield.
### Custom provider model selector coverage (2026-06-13)

Added `custom-provider-model-selector`, a real PTY e2e scenario that seeds an OpenAI-compatible custom provider, opens `/models`, chooses the Custom pack flow, selects `selector-e2e/...` catalog entries for plan/build/fast, asserts those selections are not the free-form `Use:` fallback, and proves `settings.json` persists the active custom pack, mode defaults, saved pack models, and subagent-default cleanup.

Break validations:

1. Removed custom-provider entries from `customModelCatalogProvider`; the scenario failed because the selector only offered the free-form `Use:` entry.
2. Changed `ModelSelectorComponent` to show `Use:` even for exact catalog matches; the scenario failed before selection.
3. Stopped persisting activated custom-pack mode defaults; the shell assertions saw `undefined` defaults while the saved pack still existed.

All breaks were reverted and the focused scenario passed cleanly. The custom-provider row remains partial for provider creation/remove-model validation and live custom-provider request routing breadth.

Verification:

```sh
pnpm run build:mastracode
pnpm --filter ./mastracode run e2e:test custom-provider-model-selector
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
pnpm --filter ./mastracode run e2e:test -- --jobs 4 # 116/116 passed
```

The first full-suite attempt reached 114/116 with known worker-timeout flakes in `provider-history-rejection-retry` and `prompt-context-instructions`; both passed focused retries after cache cleanup, and the clean rerun passed 116/116.

### GitHub notification reload coverage (2026-06-13)

Added `github-signals-notification-reload`, a real PTY e2e scenario that seeds a persisted GitHub notification signal plus subscribed-thread metadata, opens it through `/threads`, and asserts the loaded-history card renders `notification from github`, `high · pull-request-ci-recovered · seen`, the PR summary text, the original user prompt, and the status-line `PR#17641` projection. This closes the deterministic GitHub notification history reload parity gap; real live gitcrawl/gh integration and multi-process polling remain non-hermetic follow-up breadth.

Break validations:

1. Removed notification source rendering in `NotificationComponent`; the scenario timed out waiting for `notification from github`.
2. Dropped notification status from the details line; the scenario timed out waiting for `high · pull-request-ci-recovered · seen`.
3. Ignored GitHub subscription metadata on thread switch; the notification card still rendered, but the scenario timed out waiting for the `PR#17641` status-line projection.

All breaks were reverted and the focused scenario passed cleanly.

Verification:

```sh
pnpm run build:mastracode
pnpm --filter ./mastracode run e2e:test github-signals-notification-reload
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
pnpm --filter ./mastracode run e2e:test -- --jobs 4 # 115/115 passed
```

### Autocomplete wrapping navigation coverage (2026-06-13)

Added `autocomplete-wrapping-navigation`, a real PTY e2e scenario that seeds two project custom slash commands, opens autocomplete at `/wrap-`, proves a long custom-command description wraps far enough to render `navigation-sentinel-wrap-tail`, presses one Down arrow, and verifies AIMock receives the second command template instead of the wrapped first command. This closes the queued-followups residual wrapping/navigation gap. The row is now validated together with prior Ctrl+F image queueing, Ctrl+F custom slash queueing, and focused process-local queue cleanup/drain shields.

Break validations:

1. Replaced wrapping with one-line truncation in `WrappingAutocompleteList`; the scenario timed out waiting for `navigation-sentinel-wrap-tail`.
2. Broke Down-arrow item navigation so selection stayed on the wrapped first command; the scenario sent `Alpha should not run` and failed before the Bravo response.
3. Removed custom-command descriptions from the autocomplete provider; the scenario timed out waiting for the long description.

All breaks were reverted and the focused scenario passed cleanly.

Verification:

```sh
pnpm run build:mastracode
pnpm --filter ./mastracode run e2e:test autocomplete-wrapping-navigation
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
pnpm --filter ./mastracode run e2e:test -- --jobs 4 # 114/114 passed
```

The first full-suite attempt reached 112/114 with known worker-timeout flakes in `provider-history-rejection-retry` and `prompt-context-instructions`; both passed focused retries after cache cleanup, and the clean rerun passed 114/114.

### Ctrl+F queued custom slash autocomplete coverage (2026-06-13)

Added `ctrlf-queued-custom-slash`, a real PTY e2e scenario that starts a slow AIMock-backed active run, seeds a project custom command, types `/queue-au` to open the real custom slash-command autocomplete, presses Ctrl+F, verifies the pending message is the completed `//queue-auto` command and the footer shows `1 queued`, then waits for FIFO slash-command drain. AIMock verification proves the drained request contains the processed custom-command payload.

Verification:

```sh
pnpm run build:mastracode
pnpm --filter ./mastracode run e2e:test ctrlf-queued-custom-slash
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
pnpm --filter ./mastracode run e2e:test -- --jobs 4 # 113/113 passed
```

The first full-suite attempt reached 111/113 with known worker-timeout flakes in `provider-history-rejection-retry` and `prompt-context-instructions`; both passed focused retries after cache cleanup, and the clean rerun passed 113/113.

Break validations:

1. Removed Ctrl+F autocomplete completion in `CustomEditor`: `/queue-au` queued as an unknown command instead of resolving to `//queue-auto`, and the scenario failed before the queued payload appeared.
2. Disabled the active-run Ctrl+F enqueue callback: the scenario timed out waiting for `1 queued`, and AIMock only saw the initial request.
3. Skipped queued slash-command dispatch during FIFO drain: `//queue-auto pending…` stayed transient and the queued AIMock request never ran.

All breaks were reverted and the focused scenario passed cleanly. The queued-followups row remains partial for long autocomplete wrapping and transient-queue reload breadth.

### Ctrl+F queued image follow-up coverage (2026-06-13)

Added `ctrlf-queued-image-followup`, a real PTY e2e scenario that starts a slow AIMock-backed active run, pastes a PNG-backed follow-up while the run is streaming, presses Ctrl+F, verifies the footer shows `1 queued`, then waits for the queued action to drain after the initial `agent_end`. The scenario verifies the drained user message renders `[1 image] Queued Ctrl F image follow-up` and captures the raw OpenAI request body to prove the queued provider request contains the `image/png` file payload/base64 data with no `[image]` editor placeholder.

Verification:

```sh
pnpm run build:mastracode
pnpm --filter ./mastracode run e2e:test ctrlf-queued-image-followup
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
pnpm --filter ./mastracode run e2e:test -- --jobs 4 # 112/112 passed
```

Break validations:

1. Replaced the Ctrl+F enqueue callback with a render-only no-op: the scenario timed out waiting for `1 queued` and AIMock saw only the initial request.
2. Disabled `drainQueuedAction()` after `agent_end`: the footer stayed at `1 queued` and the queued provider request never ran.
3. Stripped image metadata from queued follow-up messages: the queued text drained, but the TUI rendered no `[1 image]` prefix and provider attachment verification failed.

All breaks were reverted and the focused scenario passed cleanly. The queued-followups row remains partial for autocomplete wrapping and transient-queue reload breadth, but active-run Ctrl+F queueing/drain with image state is now covered.

### Storage fallback history and OM-scope coverage (2026-06-13)

Added `storage-fallback-history-reload`, a real PTY e2e scenario that seeds persisted `settings.json.storage.backend = "pg"` with no connection info plus local LibSQL thread history. Startup renders the PostgreSQL fallback warning, `/threads` still loads the seeded local history from the effective LibSQL fallback store, and a shell proof confirms persisted settings still say `pg` so runtime fallback remains distinguishable from user intent.

Strengthened `storage-config.test.ts` with `getOmScope()` precedence coverage for env > project database config > global database config > default, including invalid env/config values.

Focused proof:

```sh
pnpm --filter ./mastracode exec vitest --run src/utils/__tests__/storage-config.test.ts --bail=1 --reporter=dot
pnpm run build:mastracode
pnpm --filter ./mastracode run e2e:test storage-fallback-history-reload
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
pnpm --filter ./mastracode run e2e:test -- --jobs 4 # 111/111 passed
```

Break validations:

1. Removed the `Using LibSQL fallback` warning text from the no-connection PG fallback path: `storage-fallback-history-reload` timed out waiting for the fallback guidance.
2. Pointed fallback LibSQL storage at the vector DB path instead of the main DB: the app still started, but `/threads` lost the seeded history and the scenario failed.
3. Made `getOmScope()` ignore `MASTRA_OM_SCOPE=thread`: the focused unit test failed because project config overrode the env value.

The remaining real-PostgreSQL success and LibSQL↔PostgreSQL data-migration contracts are explicitly deferred: they require a live external database/smoke environment or a migration feature Mastra Code does not currently implement. The hermetic recovery row now covers the TUI-visible save, restart, fallback, warning, local-history, and OM-scope precedence contracts.

### File attachment OM observation coverage (2026-06-13)

Added `om-attachment-observation`, a real PTY e2e scenario that enables Observational Memory, pastes a PNG through the TUI editor, drives a deterministic multi-step model/tool turn, and verifies the OM observer request includes both the `[Image #1]` placeholder text and raw `image/png` attachment data. The scenario keeps LLM traffic AIMock-backed and stubs only OpenAI `responses/input_tokens` in its temporary entrypoint wrapper so attachment thresholding is hermetic.

Verification:

```sh
pnpm run build:mastracode
pnpm --filter ./mastracode run e2e:test om-attachment-observation
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
pnpm --filter ./mastracode run e2e:test -- --jobs 4 # 110/110 passed
```

Break validations:

1. Set `omObserveAttachments` to `false`: OM still observed text, but the observer request omitted the pasted PNG payload and failed verification.
2. Dropped pasted-image file parts from `createUserSignalContent()`: the TUI still reached the model/tool turn, but OM observer input no longer contained the PNG attachment.
3. Raised the OM observation threshold out of reach: the chat/tool flow still passed, but no OM observer request was emitted and request verification failed.

All breaks were reverted and the focused scenario passed cleanly. The File attachments row is now `validated` with checked-in TUI coverage for provider payloads, loaded history, blocked-prompt retry preservation, and OM observation.

### File attachment blocked-retry coverage (2026-06-13)

Fixed the pasted-image idle submit path so pending images are cleared only after `UserPromptSubmit` allows the prompt. If the hook blocks, Mastra Code now removes the optimistic message, restores the editor text, keeps the `[image]` placeholder backed by the original pending image, and lets the user press Enter again to retry.

Added `file-attachment-blocked-retry`, a real PTY e2e scenario with a project `UserPromptSubmit` hook that blocks the first pasted-image submission and allows the retry. The scenario verifies the blocked state renders the hook error plus retryable `prompt [image]`, then asserts the retry creates exactly one AIMock request whose raw OpenAI request body contains the PNG file part and no `[image]` placeholder.

Focused proof:

```sh
pnpm --filter ./mastracode run e2e:test file-attachment-blocked-retry
```

Break validations:

1. Restored the old behavior that cleared `pendingImages` before the hook decision: retry reached AIMock but rendered text-only history, so `[1 image]` never appeared.
2. Removed editor restoration on hook block: the scenario timed out waiting for retryable `prompt [image]` input after the hook error.
3. Dropped file parts from `createUserSignalContent()`: the visible TUI flow passed, but raw provider-request verification failed because the PNG file payload was missing.

All breaks were reverted and the focused scenario passed cleanly.

### File attachment loaded-history coverage (2026-06-13)

Added `file-attachment-history-reload`, a real PTY e2e scenario that seeds persisted user signal history containing projected text-file content, an image file part, and a binary file part. The scenario opens the saved thread through `/threads` and verifies loaded history renders `[1 image] [1 file]`, the `[File: notes.md]` label, and the text attachment body, while asserting raw base64 payloads do not leak into the terminal.

A small rendering fix now includes non-image file counts in loaded user-message attachment prefixes. Focused proof:

```sh
pnpm build:core
pnpm --filter ./mastracode run e2e:test file-attachment-history-reload
```

Break validations:

1. Removed loaded file-count rendering: the scenario timed out because history showed `[1 image]` without `[1 file]`.
2. Disabled core image media-type reconstruction: after `pnpm build:core`, the scenario timed out because history showed `[2 files]` instead of `[1 image] [1 file]`.
3. Dropped persisted media types during signal rehydration: after `pnpm build:core`, the scenario again timed out with `[2 files]`.

All breaks were reverted and the focused scenario passed cleanly.

### Onboarding/global settings umbrella validation (2026-06-13)

Validated the High-risk `Settings: Onboarding and global settings` umbrella row by mapping its residual contracts to existing checked-in focused shields and real PTY scenarios. The row now points to dedicated coverage for first-run/setup completion, login refresh, API-key add/delete/env precedence, Settings API Keys handoff, custom model-pack activation/import/rename/share/edit flows, custom provider edit/delete persistence, model-selection missing-key/cancel/env precedence, OM global/thread/threshold/model-pack/role-override reload, storage backend startup fallback, browser quick settings/wizard/Browserbase/profile-mismatch/startup/active-pending projection, shell passthrough settings/env, subagent model startup restore, and Memory Gateway startup hydration.

No new product test was added in this pass because the feature card's remaining items are now either already covered or tracked on narrower feature rows where additional breadth belongs. Verification evidence comes from the immediately preceding full suite and focused checks:

```sh
pnpm run build:mastracode
pnpm --filter ./mastracode run e2e:test -- --jobs 4 # 107/107 passed
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
```

The global settings umbrella row is now `validated`; remaining work continues on narrower `needs-follow-up` rows such as storage backend, browser automation, custom providers, shell passthrough, and observational memory.

### Clipboard image provider-payload coverage (2026-06-13)

Strengthened `clipboard-image-paste`, the real PTY pasted-image scenario, so it now verifies the full TUI-to-provider path: bracketed paste adds the image marker, submit renders confirmed `[1 image]` history, AIMock receives the chat turn, and a temporary entrypoint wrapper captures the raw OpenAI request body to assert the `image/png` file part plus base64 PNG payload reaches the provider boundary.

Added focused core coverage in `agent-signal-ui-conversion.test.ts` proving multimodal user signals keep file parts when `MessageList` builds the v5 LLM prompt.

Focused verification:

```sh
pnpm --filter ./packages/core test -- --run src/agent/message-list/adapters/agent-signal-ui-conversion.test.ts --bail=1 --reporter=dot
pnpm build:core
pnpm --filter ./mastracode run e2e:test clipboard-image-paste
```

Break validations:

- Dropped file parts from `createUserSignalContent()` while leaving optimistic history intact; the scenario still rendered `[1 image]` but failed raw provider-payload verification.
- Removed media-type restoration from `storagePartsToSignalParts()`; the core regression failed with `application/octet-stream` instead of `image/png`.
- Filtered file parts out of `MessageList` v5 LLM prompt conversion; the core regression failed because the provider-bound user message became text-only.

The File attachments row remains `needs-follow-up` for text/binary file history, clear-after-send/preserve semantics, and OM observation breadth; pasted-image provider payload is now covered.

### Storage startup PostgreSQL fallback coverage (2026-06-13)

Added `storage-startup-pg-fallback`, a real PTY scenario for persisted storage backend reload. The scenario seeds `settings.json.storage.backend = "pg"` with no connection details before startup, verifies the visible PostgreSQL missing-connection warning plus LibSQL fallback guidance, then uses a local `!` shell proof to confirm the persisted backend remains `pg` while the TUI stays usable.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test storage-startup-pg-fallback
```

Break validations:

- Ignored `settings.storage.backend === "pg"` in `getStorageConfig()`; the scenario failed waiting for the startup fallback warning.
- Dropped the no-connection PostgreSQL fallback warning from `createStorage()`; the scenario failed waiting for the visible warning.
- Suppressed `result.storageWarning` rendering in `tuiMain()`; the scenario failed because the TUI started without surfacing the warning.

The Storage backend row remains `needs-follow-up` for real PostgreSQL integration/data-migration breadth; persisted backend startup reload and fallback warning are now covered without external services.





### Configured shell passthrough settings/env coverage (2026-06-13)

Added two real PTY scenarios for configured local `!` shell passthrough:

- `shell-passthrough-configured-settings` seeds `settings.json.shellPassthrough` with a POSIX wrapper executable and proves the visible `!` path invokes that wrapper before running the submitted command.
- `shell-passthrough-env-override` seeds a conflicting persisted wrapper, sets `MASTRACODE_SHELL`/`MASTRACODE_SHELL_MODE`, and proves the env wrapper runs while the persisted wrapper does not.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test shell-passthrough-configured-settings
pnpm --filter ./mastracode run e2e:test shell-passthrough-env-override
```

Break validations:

- Forced `handleShellPassthrough()` to pass default shell settings instead of `loadSettings().shellPassthrough`; `shell-passthrough-configured-settings` failed waiting for the settings wrapper marker.
- Disabled `MASTRACODE_SHELL` executable precedence in `resolveShellPassthroughInvocation()`; `shell-passthrough-env-override` failed waiting for the env wrapper marker.
- Bypassed explicit-shell execution in `createShellPassthroughSubprocess()` by falling back to `shell: true`; the configured-settings scenario failed because the wrapper marker never rendered.

The Settings row now has direct shell passthrough settings/env coverage. The Shell passthrough row remains `needs-follow-up` only for local-output loaded-history absence semantics.

### Shell passthrough long-output coverage (2026-06-13)

Added `shell-passthrough-long-output`, a real PTY scenario for the local `!` shell command path. The scenario runs a slow Node subprocess, verifies early stdout appears while the footer still shows the running state, waits for final collapsed latest-20-line output with the hidden-line hint and success footer, then sends Ctrl+E and verifies the tracked shell component expands to reveal the leading lines.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test shell-passthrough-long-output
```

Break validations:

- Changed `!` input routing to another prefix; the scenario failed because the command fell into the agent/tool path instead of local shell passthrough.
- Disabled stdout append into `ShellStreamComponent`; the scenario failed before any streamed output appeared.
- Removed `allShellComponents` tracking; the scenario reached collapsed output but failed after Ctrl+E because the shell block did not expand.

The Shell passthrough row remains `needs-follow-up`: long-running streaming and collapse/expand are now covered; remaining breadth is configured shell mode/env override e2e and loaded-history absence if needed.

### Skills command activation coverage (2026-06-13)

Added `skills-command-activation`, a real PTY scenario for seeded workspace skill discovery and activation. The scenario creates user-invocable, goal-enabled, and hidden skills in the fixture project, verifies `/skills` lists only the invocable skills, runs `/skill/skill-activation-e2e` with arguments, and runs `/goal/goal-review-e2e` so AIMock proves both explicit skill activation and goal-skill alias content reach provider requests.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test skills-command-activation
```

Break validations:

- Removed `user-invocable` filtering from `/skills`; the scenario failed because the hidden skill appeared and the count changed.
- Disabled escaping of embedded `</skill>` boundaries; the AIMock request verification failed because the escaped `&lt;/skill&gt;` marker was absent.
- Stopped registering `goalSkillCommands`; `/goal/goal-review-e2e` no longer activated and the scenario failed before the goal response.

The Skills command row remains `needs-follow-up`: seeded list/activation/goal-alias coverage is now checked in; remaining breadth is reload/staleness and symlink alias de-duplication in the real TUI if needed beyond focused workspace tests.

### Lifecycle hooks configured status/reload/blocking coverage (2026-06-13)

Added `lifecycle-hooks-configured`, a real PTY scenario for project hook configuration. The scenario boots in a fixture project with a `UserPromptSubmit` hook, verifies `/hooks` renders the configured command and description, rewrites `hooks.json`, runs `/hooks reload`, verifies the reloaded command/description, then submits a normal prompt and proves the reloaded hook blocks it before the agent turn proceeds.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test lifecycle-hooks-configured
```

Break validations:

- Removed the `hm.reload()` call from `/hooks reload`; the scenario failed because status stayed on `hook-before.cjs` instead of the reloaded hook.
- Changed exit-code-2 handling so blocking hooks were treated as non-blocking; the scenario failed because the user prompt reached the model instead of showing the hook's block reason.
- Removed hook descriptions from `/hooks` status rendering; the scenario failed waiting for the configured description.

The Lifecycle hooks row remains `needs-follow-up`: configured status/reload/blocking now has user-perspective coverage; remaining breadth is direct executor edge cases, headless lifecycle-hook decision, and broader live lifecycle events like `Stop`/session/warnings.

### Browserbase startup restore coverage (2026-06-13)

Added `browserbase-startup-restore`, a real PTY `/browser status` scenario for persisted Stagehand Browserbase settings restored at startup. The scenario boots with Browserbase enabled, verifies status shows the restored Browserbase environment, then saves a pending CDP URL without `/browser on` and proves status renders `Browser (active)`, `Pending changes (not yet applied)`, the pending CDP endpoint, and apply guidance.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test browserbase-startup-restore
```

Break validations:

- Removed startup `activeBrowserSettings` projection; the scenario failed because status collapsed to saved settings and never rendered `Browser (active)`.
- Forced Browserbase settings parsing to fall back to `LOCAL`; the scenario failed because `/browser status` showed `Environment: LOCAL` and local headless fields.
- Disabled `/browser set cdpUrl` persistence; the scenario failed because no pending CDP drift rendered.

The settings/browser rows remain `needs-follow-up`: Browserbase startup is now covered; remaining browser breadth is deeper reload variants and richer external-provider smoke.


### Browser active-vs-pending status coverage (2026-06-13)

Added `browser-active-pending-status`, a real PTY `/browser status` scenario for config drift between the active runtime browser and saved file settings. The scenario starts with enabled AgentBrowser/CDP settings, changes the saved CDP URL without running `/browser on`, then proves status renders `Browser (active)`, `Pending changes (not yet applied)`, both active and pending CDP endpoints, and explicit `/browser on` apply guidance.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test browser-active-pending-status
```

Break validations:

- Disabled config-drift detection; the scenario failed because status collapsed to the pending config and never rendered `Browser (active)`.
- Renamed the pending-settings section; the scenario failed waiting for `Pending changes (not yet applied):`.
- Replaced the `/browser on` apply guidance; the scenario failed waiting for the expected apply/reconfigure/restart copy.

The settings/browser rows remain `needs-follow-up`: active-vs-pending status is now covered; remaining browser breadth is startup variants and richer external-provider/reload depth.


### Settings API-key submenu navigation coverage (2026-06-13)

Added `settings-api-keys-navigation`, a real PTY scenario for the Settings → API Keys handoff. The scenario opens `/settings`, selects the `API Keys` row through keyboard navigation, and verifies the API-key management overlay appears with provider status details.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test settings-api-keys-navigation
```

Break validations:

- Removed the API Keys row from `SettingsComponent`; the scenario failed waiting for the visible settings entry.
- Dropped the `handleApiKeysCommand(ctx)` handoff from the Settings command callback; the scenario returned to the prompt instead of opening API-key management.
- Renamed the visible Settings row to `Provider Keys`; the scenario failed waiting for the expected API Keys label.

The Settings row remains `needs-follow-up`: `/settings` API-key navigation is now covered; remaining depth is `/models` custom-pack completion/navigation and browser active-vs-pending projection/startup variants.


### Login dialog masked input coverage (2026-06-13)

Added `login-dialog-masked-input`, a real PTY `/login` scenario for provider login prompts. The scenario patches Anthropic OAuth to request an authorization code through the real login dialog, verifies typed code text renders as asterisks instead of leaking the secret, and proves the raw code still reaches persisted OAuth credentials.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test login-dialog-masked-input
```

Break validations:

- Removed `MaskedInput` render masking; the scenario failed because the raw authorization code appeared in the terminal.
- Changed `LoginDialogComponent` to resolve a placeholder instead of `input.getValue()`; the scenario failed because persisted OAuth credentials did not contain the raw submitted code.
- Bypassed `dialog.showPrompt()` in the `/login` command's `onPrompt` callback; the scenario failed because the login dialog prompt never appeared.

The Settings row remains `needs-follow-up`: login-specific MaskedInput breadth is now covered; remaining depth is `/models` custom-pack completion/navigation, browser active-vs-pending projection, and `/api-keys` settings-submenu navigation.


### Browserbase wizard coverage and stale-option fix (2026-06-13)

Added `browser-wizard-browserbase`, a real PTY `/browser` wizard scenario for the Stagehand Browserbase path. The scenario starts from stale local browser settings, selects Stagehand → Browserbase, verifies the credential guidance, proves the local headless/launch/profile prompts are skipped, and confirms `settings.json` persists Browserbase-only settings without writing Browserbase credentials.

This surfaced and fixed a real bug: Browserbase skipped local launch prompts but still inherited old CDP/profile/executable values, causing browser creation to fail. The wizard now clears local launch/profile/storage-state options when Browserbase is selected.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test browser-wizard-browserbase
```

Break validations:

- Removed the Browserbase local-option cleanup; the scenario failed because stale CDP/profile/executable settings made browser creation fail.
- Forced persisted Stagehand env back to `LOCAL`; the scenario failed on the Browserbase summary/status assertion.
- Replaced the Browserbase credential guidance with generic copy; the scenario failed waiting for the required `BROWSERBASE_API_KEY`/`BROWSERBASE_PROJECT_ID` guidance.

The settings/browser rows remain `needs-follow-up`: Browserbase wizard persistence is now covered; remaining browser breadth is startup variants, active-vs-pending projection, and optional reload/history smoke.


### Browser profile/provider mismatch coverage (2026-06-13)

Added `browser-profile-provider-mismatch`, a real PTY `/browser` wizard scenario for reusing a browser profile previously marked by Stagehand with AgentBrowser. The scenario proves the mismatch confirmation prompt appears before persistence, `No` cancels while leaving `settings.json` and `.mastra-provider` unchanged, and `Yes` proceeds with AgentBrowser settings while rewriting the marker to `agent-browser`.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test browser-profile-provider-mismatch
```

Break validations:

- Bypassed `checkProfileProviderMismatch()` in the confirmation helper; the scenario failed waiting for `Continue anyway?`.
- Treated the `No` answer as approval; the scenario failed waiting for `Browser setup cancelled.` because the browser was enabled.
- Skipped `setProfileProvider()` after successful browser creation; the scenario failed because `.mastra-provider` stayed `stagehand` after proceeding.

The settings/browser rows remain `needs-follow-up`: profile mismatch is now covered; remaining browser breadth is Browserbase variants, active-state projection, and optional reload/history smoke.


### Browser clear-all settings coverage (2026-06-12)

Strengthened `browser-settings-persistence` to cover `/browser clear` without an argument. The scenario now starts from a non-default AgentBrowser settings block, exercises existing CDP/profile/executable quick-setting flows, then runs clear-all and proves `settings.json` resets to the disabled Stagehand defaults while removing CDP/profile/executable/agentBrowser settings.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test browser-settings-persistence
```

Break validations:

- Changed clear-all default provider from Stagehand to AgentBrowser; the shell proof failed on the persisted provider.
- Preserved `executablePath` in the clear-all reset object; the shell proof failed because the executable path survived reset.
- Skipped `saveSettings()` in the clear-all branch; the shell proof failed because old provider/executable settings remained in `settings.json`.

The browser/settings rows remain `needs-follow-up`: clear-all reset is now covered; remaining browser breadth is Browserbase/profile-mismatch variants and richer active-state projection.


### Browser wizard/export coverage (2026-06-12)

Added `browser-wizard-export`, a real PTY e2e scenario for the interactive `/browser` wizard and AgentBrowser storage-state export path. The scenario uses a deterministic entrypoint patch for `AgentBrowser.exportStorageState`, selects AgentBrowser through the wizard, chooses CDP launch mode, verifies the enabled status projection, runs `/browser export storageState`, and proves both `settings.json` and the exported file contents through shell passthrough.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test browser-wizard-export
```

Break validations:

- Remapped the AgentBrowser provider selection branch to Stagehand; the scenario failed in the wizard because the Stagehand environment prompt appeared instead of the AgentBrowser headless prompt.
- Skipped `saveSettings()` after wizard success; the scenario failed because `/browser status` showed active-vs-pending drift instead of the normal enabled status.
- Skipped `browserInstance.exportStorageState()` while still showing the success message; the scenario failed because the requested storage-state file was missing.

The browser/settings rows remain `needs-follow-up`: AgentBrowser/CDP wizard save and export are now covered, while Browserbase/profile-mismatch/clear-all variants and deeper active projection breadth remain follow-up work.


### Memory Gateway startup env coverage (2026-06-12)

Added focused `mastracode/src/__tests__/index.test.ts` coverage for the headless-relevant Memory Gateway startup bridge. The test seeds stored gateway auth plus a persisted gateway base URL, boots `createMastraCode()`, and proves startup hydrates `MASTRA_GATEWAY_API_KEY` and `MASTRA_GATEWAY_URL`, loads stored API keys under the gateway provider env var, and lets `modelAuthChecker` authorize providers served by the Mastra gateway.

Focused verification:

```sh
pnpm --filter ./mastracode exec vitest run src/__tests__/index.test.ts --reporter=dot --bail=1
```

Break validations:

- Removed stored gateway key env hydration in `mastracode/src/index.ts`; the test failed because `MASTRA_GATEWAY_API_KEY` stayed undefined.
- Removed stored gateway base-URL env hydration in `mastracode/src/index.ts`; the test failed because `MASTRA_GATEWAY_URL` stayed undefined.
- Disabled the gateway-backed provider branch in `modelAuthChecker`; the test failed because a provider marked `gateway: "mastra"` was no longer authorized.

The Settings row remains `needs-follow-up`: Memory Gateway startup env/base-URL ownership is now covered, while browser/settings wizard variants and remaining deeper submenu/navigation breadth remain follow-up work.


### Storage settings raw-value coverage (2026-06-12)

Strengthened the existing `storage-settings` checked-in TUI e2e scenario. It now verifies the PostgreSQL connection string remains masked in the serialized terminal while typing, then reads the isolated `settings.json` after save to prove the raw connection string is persisted alongside `storage.backend = "pg"`.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test storage-settings
```

Break validations:

- Rendered `MaskedInput` with the raw value instead of asterisks; the scenario failed because the terminal exposed the PostgreSQL URL.
- Submitted asterisks instead of the preserved raw value from the masked input; the scenario failed because `settings.json` persisted the masked string.
- Skipped the `/settings` command handler write for the PostgreSQL connection string; the restart notice still appeared, but the raw persisted-value assertion failed.

The Storage backend row remains `needs-follow-up`: raw connection-string persistence is now covered, while selected-backend restart/reload behavior and real PostgreSQL integration remain follow-up work.


### OM pack startup restore coverage (2026-06-12)

Added `om-pack-startup-restore` as the 94th checked-in TUI e2e scenario. The scenario seeds `settings.models.activeOmPackId = "openai"` before launch with no role-specific OM overrides, creates an AIMock-backed thread, opens `/om`, verifies both Observer and Reflector model rows restore to the built-in OpenAI Mini model (`gpt-5.4-mini`), and proves `settings.json` remains pack-backed (`openai:null:null:null`) rather than converting to custom overrides.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test om-pack-startup-restore
```

Break validations:

- Disabled built-in OM pack model resolution in `resolveOmRoleModel`; the scenario failed because `/om` restored fallback/default models instead of `gpt-5.4-mini`.
- Skipped startup observer/reflector state seeding in `mastracode/src/index.ts`; the scenario failed because `/om` did not receive the resolved pack model state.
- Changed the built-in OpenAI OM pack model ID; the scenario failed because `/om` showed `gpt-5.5` instead of `gpt-5.4-mini`.

The Settings row remains `needs-follow-up`: built-in OM pack startup reload parity is now covered, while browser/settings wizard variants and deeper submenu/navigation breadth remain follow-up work.


### API key multi-provider delete coverage (2026-06-12)

Added `api-key-multi-provider-delete` as the 93rd checked-in TUI e2e scenario. The scenario seeds stored `302ai` and Anthropic API keys, opens `/api-keys`, proves provider ordering shows `302ai` before `anthropic`, deletes the selected `302ai` key, then uses shell passthrough to prove the deleted provider is cleared from both `auth.json` and the current env projection while Anthropic remains stored and env-backed.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test api-key-multi-provider-delete
```

Break validations:

- Reversed provider sorting; the scenario failed because `302ai` no longer appeared in the initial sorted viewport.
- Removed the wrong provider key during Delete; the scenario failed because `302ai` stayed stored.
- Skipped process-env cleanup after stored-key deletion; the scenario failed because `302ai` stayed visible as env-backed instead of `not set`.

The Settings row remains `needs-follow-up`: direct `/api-keys` provider ordering and multi-provider delete isolation are now covered, while remaining settings submenu navigation breadth and deeper wizard/reload parity remain follow-up work.

### Subagent model startup restore coverage (2026-06-12)

Added `subagent-model-startup-restore` as the 92nd checked-in TUI e2e scenario. The scenario seeds an active custom model pack before launch, creates a thread through the real TUI, delegates to the Explore subagent, verifies the completed subagent footer uses the restored fast model (`openai/gpt-5.5`) instead of the parent/build default, and proves the persisted settings still carry the active custom pack/defaults.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test subagent-model-startup-restore
```

Break validations:

- Remapped Explore startup defaults from `fast` to `plan`; the delegated subagent used `openai/gpt-5.4-mini` instead of the restored fast model.
- Ignored restored custom-pack defaults in settings resolution; the delegated subagent fell back to built-in defaults instead of the seeded custom pack.
- Stopped applying restored defaults to subagent definitions; Explore again used the parent/build model rather than the restored fast model.

The Settings row remains `needs-follow-up`: model-pack-backed subagent startup defaults are now covered, while remaining browser/settings wizard breadth and deeper `/subagents` override reload cases remain follow-up work.

### OM model override reload coverage (2026-06-12)

Added `om-model-override-reload` as the 91st checked-in TUI e2e scenario. The scenario seeds a custom provider plus saved role-specific OM observer/reflector overrides before launch, asserts `/om` restores those role values on startup, changes both roles through the real model selectors, then proves `settings.json` and active-thread metadata persist the updated observer/reflector model IDs.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test om-model-override-reload
```

Break validations:

- Skipped startup OM role override seeding in `createMastraCode()`; `/om` restored built-in Gemini defaults instead of the seeded role overrides.
- Skipped `saveSettings()` in `/om` role override persistence; visible runtime state updated, but `settings.json` kept the old seeded observer/reflector IDs.
- Bypassed `switchReflectorModel()` thread-setting persistence; global settings updated, but the active thread metadata lacked the reflector role model ID.

The Settings row remains `needs-follow-up`: OM role override reload is now covered, while browser/settings wizard breadth and deeper subagent/remaining model-pack reload parity remain follow-up work.


### Setup login refresh coverage (2026-06-12)

Added `setup-login-refresh` as the 90th checked-in TUI e2e scenario. The scenario removes seeded settings/auth state, starts first-run onboarding, completes a deterministic Anthropic OAuth login through the real Authentication step, verifies the Model Packs and Observational Memory steps refresh to expose Anthropic choices without restarting, then proves `auth.json` and `settings.json` persist the OAuth credential and selected built-in mode/OM pack IDs.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test setup-login-refresh
```

Break validations:

- Skipped the post-login `updateModePacks()`/`updateOmPacks()` refresh; setup stayed on Custom-only packs and never showed Anthropic.
- Skipped OAuth credential persistence in `AuthStorage.login()`; refreshed provider access stayed false, so Anthropic never appeared.
- Skipped active model-pack persistence in `applyOnboardingResult()`; setup completed visibly, but the settings shell proof showed `activeModelPackId=null`.

The Settings row remains `needs-follow-up`: `/setup` login refresh is now covered, while browser wizard breadth and deeper reload parity remain follow-up work.


### Browser startup restore coverage (2026-06-12)

Added `browser-startup-restore` as the 89th checked-in TUI e2e scenario. The scenario seeds enabled AgentBrowser/CDP settings before launch, starts the normal `src/main.ts` path through a tiny AgentBrowser preload patch, verifies `/browser status` restores provider/headless/CDP projection without requiring `/browser on`, then sends an AIMock-backed prompt and proves the first model request includes the browser context processor output plus browser tools.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test browser-startup-restore
```

Break validations:

- Disabled the startup browser restore block in `main.ts`; the request still reached AIMock but lacked the browser context marker and browser tools.
- Made `createBrowserFromSettings()` return no AgentBrowser for the persisted AgentBrowser config; status still reflected settings, but the model request again lacked active browser context/tools.
- Hid the CDP URL from `/browser status`; the visible status assertion failed before the model turn.

The Settings row remains `needs-follow-up`: enabled TUI browser startup attach/status/tool injection is now covered, while browser wizard breadth, login refresh, and deeper settings reload parity remain follow-up work.


### OM threshold persistence coverage (2026-06-12)

Added `om-threshold-persistence` as the 88th checked-in TUI e2e scenario. The scenario seeds persisted global OM thresholds before startup, creates an active AIMock-backed thread, opens `/om` to prove the overlay restores 12k/80k from settings, changes observation/reflection thresholds to 15k/60k through the real threshold submenus, then proves `settings.json`, the status footer, and active-thread metadata carry the updated values.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test om-threshold-persistence
```

Break validations:

- Removed `saveSettings()` from threshold persistence; the shell proof stayed at the seeded `12000:80000` values.
- Removed `setThreadSetting()` for threshold changes; global settings updated, but the active-thread metadata proof disappeared.
- Disabled startup seeding of `observationThreshold`/`reflectionThreshold`; `/om` opened with default 30k/40k instead of seeded 12k/80k.

The Settings row remains `needs-follow-up`: `/om` threshold restore/persistence is now covered, while browser wizard/startup restore, login refresh, and deeper thread/subagent/OM model reload breadth remain follow-up work.


### GitHub polling inbox coverage (2026-06-12)

Added `github-signals-polling-inbox` as the 87th checked-in TUI e2e scenario. The scenario seeds a persisted subscribed thread whose cursor last observed failing CI, points `MASTRACODE_GITCRAWL_BIN` at a deterministic recovered-CI sqlite fixture, triggers polling, renders the delivered `pull-request-ci-recovered` GitHub notification card, asks the model to call `notification_inbox read`, proves the notification status becomes `seen`, and verifies the subscribed thread appears after `/new` → `/threads` reload.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test github-signals-polling-inbox
```

Break validations:

- Removed GitHub signal registration from Mastra Code agent wiring; polling failed before notification delivery.
- Suppressed GitHub activity notification sending in the runtime package artifact; the scenario timed out before inbox read.
- Disabled `notification_inbox` dynamic-tool registration; the model saw `ToolNotFoundError`, the DB proof stayed `delivered:pull-request-ci-recovered`, and the `seen` assertion failed.

The GitHub signal subscriptions row remains `needs-follow-up`: polling delivery and inbox read transitions are now covered, while branch auto-subscribe lifecycle, multi-process polling handoff, and GitHub notification history reload parity remain follow-up breadth.


### Harness display-state status-line coverage (2026-06-12)

Validated the `Integrations: Harness display state` row by adding focused Mastra Code TUI routing coverage to the already checked-in streamed-tool/task e2e evidence. `mastracode/src/tui/event-dispatch.test.ts` now proves that `display_state_changed` is the status-line refresh trigger and that raw streamed `tool_input_delta` events do not directly refresh the status line, preserving display-state coalescing for long tool-input streams.

Focused verification:

```sh
pnpm --filter ./mastracode exec vitest run src/tui/event-dispatch.test.ts --reporter=dot --bail=1
pnpm --filter ./packages/core exec vitest run src/harness/display-state.test.ts --reporter=dot --bail=1
pnpm --filter ./mastracode run e2e:test streaming-tool-args
```

Break validations:

- Removed the `display_state_changed` status-line refresh; the focused TUI test failed with zero `updateStatusLine()` calls.
- Added a direct `tool_input_delta` status-line refresh; the focused TUI test failed because streamed deltas bypassed the display-state event path.
- Removed scheduler coalescing in `DisplayStateScheduler.notify()`; the focused core test failed after 101 immediate callbacks before the coalescing window.

The row is now `validated`: core covers the scheduler/coalesced subscriber contract, the focused TUI test covers status-line routing, and existing checked-in e2e scenarios cover live streamed tool args, live task progress, and loaded-history tool/task reconstruction.


### Provider history rejection retry coverage (2026-06-12)

Added `provider-history-rejection-retry` as the 86th checked-in TUI e2e scenario. The scenario seeds a loaded-history thread with an invalid stored tool-call ID, routes a custom OpenAI-compatible provider through AIMock, injects a one-shot HTTP 400 matching Anthropic's `tool_use.id` validation error, and proves the recovered request reaches AIMock only after `ProviderHistoryCompat` retries with the sanitized `call_provider_history_retry` ID.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test provider-history-rejection-retry
```

Break validations:

- Changing the Anthropic tool-ID error pattern prevented the retry; the scenario timed out before any successful AIMock request.
- Making `sanitizeToolId()` a no-op let the retry reach AIMock but failed the shell proof because the forwarded request still contained the invalid ID.
- Removing `ProviderHistoryCompat` from Mastra Code error processors prevented the retry path entirely, again yielding zero successful AIMock requests.

The Provider history compatibility row is now `validated`: TUI coverage exists for both provider-boundary prompt stripping (`provider-history-compat`) and reactive API-error retry recovery (`provider-history-rejection-retry`), with core unit shields covering rule-level details.


### MCP OAuth storage persistence coverage (2026-06-12)

Added focused `mastracode/src/mcp/__tests__/manager.test.ts` coverage for Mastra Code's file-backed MCP OAuth storage. The test uses isolated `MASTRA_APP_DATA_DIR`, configures an OAuth HTTP MCP server, writes initial tokens through the manager-provided storage, recreates managers with the same project/server config, and verifies the same storage file is reused and refreshed token replacements persist to disk.

Focused verification:

```sh
pnpm --filter ./mastracode exec vitest run src/mcp/__tests__/manager.test.ts --reporter=dot --bail=1
```

Additional verification observed while attempting the package script filter: `pnpm --filter ./mastracode test -- --run src/mcp/__tests__/manager.test.ts --reporter=dot --bail 1` ran the full Mastra Code unit suite, which passed (129 files / 1315 tests).

Break validations:

- Skipping `FileOAuthStorage.set()` writes made the recreated manager lose the initial tokens.
- Making the OAuth storage fingerprint unstable across manager instances changed the file path and lost persisted tokens.
- Making `FileOAuthStorage.read()` ignore the persisted file made the recreated manager lose stored tokens.

The MCP server configuration row remains `needs-follow-up`; durable Mastra Code OAuth token persistence/refresh replacement is now covered, while a full protected-server OAuth authorization/failure-display flow remains optional remaining breadth.


### Headless MCP tool availability coverage (2026-06-12)

Added `headless-mcp-tool-availability` as the 85th checked-in e2e scenario. The scenario launches a delayed, header-protected Streamable HTTP MCP server through isolated global MCP config, runs `headlessMain` with AIMock, and verifies the namespaced MCP tool result (`MC_HEADLESS_MCP_RESULT:headless-e2e:ok`) reaches the follow-up model request. The product fix makes headless startup await MCP initialization before sending the first prompt so the first provider turn has the configured MCP tools available.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test headless-mcp-tool-availability
```

Break validations:

- Restoring background-only headless MCP init made the delayed server race the first model turn; the AIMock follow-up saw `Tool "e2e_headless_mcp_delayed_lookup" not found` instead of the MCP payload.
- Dropping HTTP request headers from MCP server definitions made the protected server reject requests, so the MCP payload never reached the follow-up request.
- Disabling MCP dynamic-tool injection removed the connected MCP tool from the runtime tool map, again preventing the real MCP payload from reaching the model follow-up.

The MCP server configuration row remains `needs-follow-up`; this chunk closes headless HTTP MCP tool availability, while OAuth token persistence/refresh remains.


### Long-running MCP tool coverage (2026-06-12)

Added `mcp-long-running-tool` as the 84th checked-in TUI e2e scenario, committed as `7b0d2f3e64`. The scenario launches a local Streamable HTTP MCP server with a header-protected `slow_lookup` tool, waits beyond a short timeout budget before returning `MC_MCP_LONG_TOOL_RESULT:timeout-e2e:complete`, invokes the namespaced tool through AIMock, and verifies the delayed tool result reaches the follow-up model request.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test mcp-long-running-tool
```

Break validations:

- Reducing the MCP client timeout to 500ms let the UI run but prevented the delayed MCP result from reaching the follow-up AIMock request.
- Disabling MCP dynamic-tool injection kept the provider turn from receiving the real MCP result.
- Removing server-name namespacing from collected MCP tools removed `e2e_long_mcp_slow_lookup` from the provider-visible tool list.

The MCP status/configuration rows remain `needs-follow-up`; this chunk closes long-running MCP timeout integration breadth, while OAuth token persistence/refresh and headless MCP tool availability remain.


### Setup custom-pack completion coverage (2026-06-12)

Added `setup-custom-pack-completion` as the 83rd checked-in TUI e2e scenario. The scenario seeds completed setup state, launches `/setup`, skips auth, selects the Custom mode-pack path, names a new pack, chooses env-backed synthetic `302ai` models for plan/build/fast, selects a custom OM model, disables YOLO, and proves `settings.json` persisted the saved custom pack, active/onboarding pack IDs, mode defaults, custom OM override, stale subagent override cleanup, and YOLO preference.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test setup-custom-pack-completion
```

Break validations:

- Skipping per-mode custom model capture left persisted custom pack/default models empty.
- Skipping the new custom-pack settings upsert left active defaults changed but no saved pack entry.
- Dropping custom OM override persistence left `omModelOverride` as `null` after selecting a custom OM model.

The Settings onboarding/global-settings row remains `needs-follow-up`; this chunk closes `/setup` custom-pack completion, while login refresh, browser wizard/startup restore, and broader reload parity remain.


### Model selection cancel/env precedence coverage (2026-06-12)

Added `model-selection-cancel-env` as the 82nd checked-in TUI e2e scenario. The scenario seeds a saved custom model pack, launches with a real `302AI_API_KEY`, edits the pack through `/models`, selects a synthetic `302ai` plan model that should inherit env-backed provider availability without opening the missing-key dialog, then selects a second synthetic provider for build mode, cancels the `API Key Required` dialog, saves, and proves both selected model IDs persisted while no stored auth keys were written.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test model-selection-cancel-env
```

Break validations:

- Forcing synthetic model items to ignore sibling provider `hasApiKey` metadata made the env-backed `302ai` selection open an unexpected API-key dialog.
- Storing an API key from the missing-key dialog cancel path made shell proof show `MODEL_CANCEL_CANCEL_KEY=cancelled-key-should-not-store` instead of `missing`.
- Skipping custom-pack edit settings persistence left both plan/build models at their original values.

The settings row remains `needs-follow-up`; this chunk closes the model-selection cancellation/env-precedence gap, while custom-pack completion, browser wizard/startup restore, and broader reload parity remain.


### Startup update prompt coverage (2026-06-12)

Added `update-startup-prompt` as the 81st checked-in TUI e2e scenario. The scenario boots the real TUI with hermetic `MASTRACODE_UPDATE_LATEST_VERSION` and `MASTRACODE_UPDATE_CHANGELOG` env overrides, waits for the automatic startup inline update prompt, verifies the changelog entry is rendered, selects `No`, and proves `settings.updateDismissedVersion` is persisted through shell passthrough.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test update-startup-prompt
```

Break validations:

- Disabling startup update-check scheduling prevented the automatic prompt from rendering.
- Dropping startup changelog fetch rendered the prompt without the `What's new` section and fixture entry.
- Skipping dismissed-version persistence left `settings.updateDismissedVersion` undefined after selecting `No`.

The auto-update row remains `needs-follow-up`; this chunk closes automatic startup prompt/changelog/dismissal persistence, while dismissed-version startup suppression, passive recheck banner, safe `Yes` install success, and packaged-version detection remain.


### Custom pack import rename coverage (2026-06-12)

Added `custom-pack-import-rename` as the 80th checked-in TUI e2e scenario. The scenario seeds a custom OpenAI-compatible provider plus an existing saved custom pack, imports a colliding `mastra-pack:` payload through `/models`, selects the Rename collision branch, enters a new pack name, and proves `settings.json` retains the original pack while activating the renamed imported pack with imported model defaults.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test custom-pack-import-rename
```

Break validations:

- Skipping the renamed import `name`/`id` mutation applied the import under the original pack name and failed the renamed confirmation assertion.
- Misrouting the Rename collision action as overwrite skipped the rename prompt and failed the modal-flow assertion.
- Replacing the existing saved pack instead of pushing the renamed import left only one custom pack and failed the persisted two-pack proof.

The Settings onboarding/global-settings row remains `needs-follow-up`; this chunk closes import-collision Rename breadth, while custom-pack completion, model-selection cancellation/env-precedence, browser wizard/startup restore, and reload parity remain.


### MCP skipped validation coverage (2026-06-12)

Added `mcp-skipped-validation` as the 79th checked-in TUI e2e scenario. The scenario seeds project `.mastracode/mcp.json` with invalid MCP server entries covering command+URL ambiguity, malformed URL parsing, invalid OAuth redirect validation, and missing command/url fields. It launches a real MCP-enabled TUI entrypoint, asserts `/mcp status` renders all skipped validation reasons, then opens the interactive `/mcp` selector and asserts the same skipped rows are visible there.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test mcp-skipped-validation
```

Break validations:

- Misclassifying command+URL entries as stdio made `ambiguous_entry` appear as a connecting configured server instead of a skipped validation reason.
- Allowing invalid OAuth configs through validation made `bad_oauth_redirect` become a failed HTTP server instead of a skipped reason.
- Hiding skipped rows in `McpSelectorComponent` left `/mcp status` intact but made the interactive selector omit the skipped server reasons.

The MCP rows remain `needs-follow-up`; this chunk closes skipped validation display breadth, while OAuth token persistence/refresh, headless MCP tool availability, long-running MCP timeout integration, and focused selector detail/polling tests remain.


### MCP selector reconnect coverage (2026-06-12)

Added `mcp-selector-reconnect` as the 78th checked-in TUI e2e scenario. The scenario starts with a failed header-protected Streamable HTTP MCP server from project config, marks the same local server ready via shell passthrough, opens the interactive `/mcp` selector, reconnects the failed server through the submenu, rewrites `.mastracode/mcp.json` to add a second HTTP server, and presses selector `r` to prove reload-all refreshes the visible overlay with two connected server/tool rows.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test mcp-selector-reconnect
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
```

Break validations:

- Disabling the selector `Reconnect` action left `selector_retry` failed and timed out waiting for the connected tool row.
- Disabling the selector `r` reload shortcut kept the overlay at one server after the project config rewrite and timed out waiting for `selector_reload`.
- Dropping reload-result status replacement let reload run but kept the overlay stale at one server, again failing the `selector_reload` assertion.

The MCP rows remain `needs-follow-up`; this chunk closes selector reconnect/reload-all user-perspective breadth, while skipped HTTP validation reason snapshots, headless MCP tool availability, OAuth token persistence/refresh, long-running MCP timeout integration, and focused selector detail/polling tests remain.


### Browser toggle attach coverage (2026-06-12)

Added `browser-toggle-attach` as the 77th checked-in TUI e2e scenario. The scenario seeds AgentBrowser CDP settings, drives `/browser status` disabled, runs `/browser on`, verifies enabled `/browser status` renders the AgentBrowser provider and CDP endpoint, sends a normal AIMock-backed user turn, and proves persisted settings plus provider-visible browser tools (`browser_goto`, `browser_snapshot`) reached the model request.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test browser-toggle-attach
```

Break validations:

- Skipping `applyBrowserToAgents()` made the scenario's AIMock request verification fail because browser tools were absent from the model request.
- Skipping `saveSettings()` after `/browser on` made `/browser status` render active/pending drift instead of `Browser: enabled` and failed the status assertion.
- Hiding the CDP URL from `/browser status` failed the endpoint assertion.

The browser automation row remains `needs-follow-up`; this chunk closes manual `/browser on` attach/tool-injection breadth, while startup-restored browser recreation, provider mismatch/export/provider wizard breadth, and reload/history parity remain.


### Custom provider edit/share/import coverage (2026-06-12)

Added `custom-provider-edit-share-import` as the 76th checked-in TUI e2e scenario. The scenario seeds a custom OpenAI-compatible provider plus a saved custom model pack, shares the pack through the real `/models` custom-pack action menu, decodes the clipboard `mastra-pack:` payload through shell passthrough, starts an import of the same shared pack and selects the collision `Cancel` action, then edits the provider name, base URL, and API key through `/custom-providers` default-valued modal prompts. Final shell assertions prove the shared import did not activate a pack while the provider edit persisted and preserved model IDs.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test custom-provider-edit-share-import
```

Break validations:

- Corrupting `serializePack()` wrote the wrong model ID to the clipboard payload and failed the decoded `PACK_CLIPBOARD_MODELS` assertion.
- Letting import collision `Cancel` fall through activated the imported pack and failed the persisted `CUSTOM_IMPORT_ACTIVE=null` assertion.
- Skipping `saveSettings()` in provider edit kept the original provider name/URL/API key in `settings.json` and failed the persisted provider assertion.

The settings and custom-provider rows remain `needs-follow-up`; this chunk closes provider edit plus custom-pack share/import-cancel modal breadth, while custom-pack completion/import-rename, invalid provider URL/duplicate-name branches, remove-model, model-selection cancellation/env precedence, browser wizard/startup restore, and reload parity remain.


### MCP reload config coverage (2026-06-12)

Added `mcp-reload-config` as the 75th checked-in TUI e2e scenario. The scenario starts from a hermetic project `.mastracode/mcp.json` containing a failing stdio MCP server, launches Mastra Code, verifies startup and `/mcp status` show the `reload_before [stdio]` failure, rewrites the project config via shell passthrough to a local header-protected Streamable HTTP MCP server, runs `/mcp reload`, and verifies `/mcp status` renders `reload_after [http]` plus the `reload_after_reload_probe` tool.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test mcp-reload-config
```

Break validations:

- Skipping disk config reload in `McpManager.reload()` kept the old `reload_before` server and made `/mcp reload` report `0 server(s) connected, 0 tool(s)`.
- Ignoring the project `.mastracode/mcp.json` during config load prevented the initial `reload_before` server from loading and failed the startup assertion.
- Suppressing `/mcp status` tool-name display allowed the server to connect but hid `reload_after_reload_probe`, failing the post-reload status assertion.

The MCP rows remain `needs-follow-up`; text `/mcp reload` and project file-config status transition are now covered, while selector-specific reload/reconnect UI, skipped HTTP validation reasons, OAuth token persistence/refresh, headless MCP tool availability, and long-running MCP timeout integration remain.


### MCP HTTP tool-call coverage (2026-06-12)

Added `mcp-http-tool-call` as the 74th checked-in TUI e2e scenario. The scenario starts a local Streamable HTTP MCP server inside the custom entrypoint, requires the configured `x-mc-e2e` request header, passes the server through programmatic `createMastraCode({ mcpServers })`, verifies `/mcp status` renders `e2e_http_mcp [http]` with the namespaced tool, then uses AIMock to call `e2e_http_mcp_lookup_status` through the real model/tool loop and assert the MCP result reaches the follow-up model request.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test mcp-http-tool-call
```

Break validations:

- Misclassifying HTTP server transport as `stdio` made `/mcp status` render `[stdio]` and failed the status assertion.
- Dropping HTTP `requestInit.headers` made the local MCP server reject connection with `missing x-mc-e2e header` and failed startup/status.
- Removing MCP tools from `createDynamicTools()` left the model without a real MCP tool result; the scenario's AIMock request verification failed because `MC_MCP_HTTP_TOOL_RESULT:mcp-http-e2e:ok` never reached a model request.

The MCP rows remain `needs-follow-up`; this chunk closes real HTTP transport/header/tool-call coverage, while `/mcp reload`/selector actions, skipped HTTP validation reasons, OAuth token persistence/refresh, headless MCP tool availability, and long-running MCP result timeout coverage remain.


### GitHub unsubscribe reload coverage (2026-06-12)

Added `github-signals-unsubscribe-reload` as the 73rd checked-in TUI e2e scenario. The scenario seeds an isolated thread with GitHub Signals metadata for `mastra-ai/mastra#17639`, enables experimental GitHub Signals in `settings.json`, points `MASTRACODE_GITCRAWL_BIN` and `GITCRAWL_DB_PATH` at deterministic local fixtures, opens the persisted thread through `/threads`, verifies `/github debug` sees the active subscription, runs `/github unsubscribe mastra-ai/mastra#17639`, verifies `/github debug` reports no subscribed PRs, then switches away and reopens the thread to prove the empty subscription state reloads.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test github-signals-unsubscribe-reload
```

Break validations:

- Skipping `GithubSignals.#unsubscribe` metadata persistence kept `/github debug` at one subscription and failed the scenario.
- Corrupting `/github unsubscribe` command dispatch produced the usage error instead of the unsubscribe result and failed the scenario.
- Corrupting the empty-subscription debug projection replaced `no subscribed PRs` with alternate copy and failed the scenario.

The `Git: GitHub signal subscriptions` row remains `needs-follow-up` for interval polling delivery, notification inbox read transitions, branch auto-subscribe lifecycle, and notification history reload parity.


### State signal browser processor coverage (2026-06-12)

Added `state-signal-browser-processor` as the 72nd checked-in TUI e2e scenario. The scenario starts Mastra Code with a deterministic browser provider, lets `BrowserContextProcessor` emit a live `State snapshot: browser` during the first AIMock-backed model turn, mutates the browser state through shell passthrough, and verifies the second normal model turn emits a `State delta: browser` with user-driven active URL change classification. AIMock request verification proves the processor-generated browser state is included in model request bodies.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test state-signal-browser-processor
```

Break validations:

- Skipping browser processor state computation removed the live `State snapshot: browser` card and failed the scenario.
- Ignoring active state history caused the second browser update to render another snapshot instead of a delta and failed the scenario.
- Disabling user-driven active URL change classification rendered `active tab URL changed` instead of `user changed active tab URL`, failed the visible assertion, and prevented the AIMock fixture from matching.

The `Chat: Processor state signals` row is now `validated`: public active `sendStateSignal()`, loaded-history state-signal reconstruction, live browser processor snapshot/delta projection, and evicted-snapshot refresh after pruning are covered.


### Settings startup model restore coverage (2026-06-12)

Added `settings-startup-model-restore` as the 71st checked-in TUI e2e scenario. The scenario seeds `settings.json` with an active custom model pack before the TUI launches, verifies the initial status footer boots with the persisted build model instead of stale/default model values, opens `/models` to prove the saved pack is restored into the switcher with the persisted model details, and uses shell passthrough to confirm the seeded settings remain intact.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test settings-startup-model-restore
```

Break validations:

- Returning stale `modeDefaults` from `resolveModelDefaults()` for a valid active custom pack booted the footer with `stale-mode-defaults/build` and failed the scenario.
- Ignoring effective defaults in `applyEffectiveDefaultsToV1Modes()` booted the footer with the built-in Anthropic default instead of the persisted custom build model.
- Omitting saved custom packs from `getAvailableModePacks()` left `/models` showing only New Custom/Import and failed the saved-pack visibility assertion.

The `Settings: Onboarding and global settings` row remains `needs-follow-up`; this chunk closes active custom model-pack startup/footer restoration plus saved-pack switcher visibility, while thread/subagent/OM reload parity, browser wizard/startup restore, custom-pack share/import-cancel/completion, and model-selection cancellation/env-precedence breadth remain.


### Custom pack rename active coverage (2026-06-12)

Added `custom-pack-rename-active` as the 70th checked-in TUI e2e scenario. The scenario seeds an active saved custom model pack, opens `/models`, chooses `Edit`, renames the pack through the real modal input, saves, and uses shell passthrough to prove `settings.json` migrates the active pack ID and onboarding mode pack ID to the new custom pack, removes the old pack entry, and preserves the plan/build/fast model defaults.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test custom-pack-rename-active
```

Break validations:

- Dropping `previousPackId` during rename left the old active/onboarding IDs and duplicate old/new packs, failing the scenario.
- Skipping onboarding pack-id migration left `RENAME_ONBOARDING=null`, failing the scenario.
- Skipping `saveSettings()` after edit showed the success message but left the old persisted pack/settings, failing the scenario.

The `Settings: Onboarding and global settings` row remains `needs-follow-up`; this chunk closes active custom-pack targeted rename/edit persistence, while custom-pack share/import-cancel/completion, model-selection cancellation/env-precedence, browser wizard/startup restore, and reload breadth remain.


### Custom pack import overwrite coverage (2026-06-12)

Added `custom-pack-import-overwrite` as the 69th checked-in TUI e2e scenario. The scenario seeds a custom provider plus a saved custom pack, opens `/models`, selects `Import Pack`, pastes a deterministic `mastra-pack:` string with a colliding pack name, confirms `Overwrite`, and uses shell passthrough to prove the imported model defaults, active pack ID, and saved pack models persist in `settings.json`.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test custom-pack-import-overwrite
```

Break validations:

- Skipping `applyPack()` after import rendered the success message but left `IMPORT_ACTIVE=null`, old pack models, and empty mode defaults.
- Returning early from the overwrite collision branch prevented `Imported and activated Imported Pack E2E pack` from rendering.
- Corrupting shared-pack deserialization by mapping the plan model from build persisted the wrong plan/default model and failed the scenario.

The `Settings: Onboarding and global settings` row remains `needs-follow-up`; this chunk closes `/models` shared-pack import collision/overwrite persistence, while custom-pack completion/edit/share, model-selection cancellation/env-precedence, browser wizard/startup restore, and reload breadth remain.


### Browser settings persistence coverage (2026-06-12)

Added `browser-settings-persistence` as the 68th checked-in TUI e2e scenario. The scenario uses `/browser set cdpUrl`, `/browser set profile`, `/browser set executablePath`, and `/browser clear profile` through the real PTY TUI, then uses shell passthrough to prove `settings.json` clears CDP when switching to a profile, enables Stagehand profile preservation, persists the executable path, and removes profile/preserve state when the profile is cleared.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test browser-settings-persistence
```

Break validations:

- Skipping profile-driven `cdpUrl` clearing left `BROWSER_AFTER_PROFILE_CDP=ws://...` and failed the scenario.
- Skipping `preserveUserDataDir` cleanup when clearing profile left `BROWSER_PRESERVE=true` and failed the scenario.
- Skipping `executablePath` persistence left `BROWSER_EXEC=missing` and failed the scenario.

The `Settings: Onboarding and global settings` row remains `needs-follow-up`; this chunk closes browser quick-setting persistence/mutual-exclusion, while browser wizard/startup restore, custom-pack completion/import/edit/share, model-selection cancellation/env-precedence, and reload breadth remain. The `Integrations: Browser automation` row also gains partial TUI coverage for quick settings; live `/browser on` attach remains follow-up.


### Model-selection API-key prompt coverage (2026-06-12)

Added `model-selection-api-key-prompt` as the 67th checked-in TUI e2e scenario. The scenario seeds a saved custom model pack, opens `/models`, edits the plan-mode model, selects a synthetic `302ai` model with no configured key, verifies the `API Key Required` dialog shows the `302AI_API_KEY` hint and masks typed input, saves the edited pack, and uses shell passthrough to prove `auth.json`, `process.env`, and `settings.json` all reflect the selected model/key.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test model-selection-api-key-prompt
```

Break validations:

- Bypassing `promptForApiKeyIfNeeded()` skipped the API-key dialog and failed the scenario.
- Skipping `authStorage.setStoredApiKey()` left no stored key/env projection and failed the shell verification.
- Dropping `apiKeyEnvVar` propagation for synthetic model items removed the `302AI_API_KEY` hint/projection and failed the scenario.

The `Settings: Onboarding and global settings` row remains `needs-follow-up`; this chunk closes the model-selection-triggered key storage/masking path, while cancellation/env-precedence breadth, browser/global settings, custom-pack completion/import/edit/share, and reload behavior remain.

### Custom provider delete coverage (2026-06-12)

Added `custom-provider-delete` as the 66th checked-in TUI e2e scenario. The scenario seeds a custom OpenAI-compatible provider and unrelated saved custom pack, opens `/custom-providers`, selects the provider, chooses `Delete provider`, confirms the destructive modal, and uses shell passthrough to prove `settings.json` no longer contains the provider while unrelated custom packs remain intact.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test custom-provider-delete
```

Break validations:

- Skipping `removeCustomProviderFromSettings()` left `CUSTOM_PROVIDER_COUNT=1` and failed the scenario.
- Routing the `Delete provider` option to a non-delete action prevented the destructive confirmation modal and failed the scenario.
- Skipping `saveSettings()` after removal showed the success message but left the provider in `settings.json`, failing the persisted count assertion.

The `Settings: Onboarding and global settings` row remains `needs-follow-up`; this chunk closes the `/custom-providers` delete persistence path, while model-selection missing-key, browser/global-settings, custom-pack completion/import/edit/share, and reload breadth remain.

### API key delete/env preservation coverage (2026-06-12)

Added `api-key-delete-env` as the 65th checked-in TUI e2e scenario. The scenario seeds a stored `302ai` API key and a real `302AI_API_KEY`, opens `/api-keys`, deletes the stored key with Delete, verifies the list falls back to `✓ (env)` with the environment-variable detail copy, then uses shell passthrough to prove `auth.json` no longer contains `apikey:302ai` while `302AI_API_KEY` still has the original shell value.

Product fix: `/api-keys` deletion now only clears `process.env[envVar]` when that env value matches the stored key being removed, then invalidates and reloads the model list before rebuilding the provider table. This preserves real shell credentials while still cleaning env projections that came from stored keys.

Focused verification:

```sh
pnpm --filter ./mastracode run e2e:test api-key-delete-env
pnpm run build:mastracode
pnpm --filter ./mastracode check
pnpm --filter ./mastracode lint
TOOL_EXECUTION_TIMEOUT=600000 pnpm --filter ./mastracode run e2e:test -- --jobs 2
```

Break validations:

- Deleting `process.env[envVar]` unconditionally made `302ai` fall back to `not set` and failed the scenario.
- Skipping `authStorage.remove()` left the UI on `✓ (stored)` and failed the scenario.
- Changing the env-key detail copy away from `Key set via environment variable` failed the scenario.

The `Settings: Onboarding and global settings` row remains `needs-follow-up`; this chunk closes the `/api-keys` delete/env precedence gap, but missing-key model selection, browser/global-settings, custom-pack completion/edit/share/delete, and reload breadth remain.

### Notification inbox reload coverage (2026-06-12)

Added `notification-inbox-reload` as the 64th checked-in TUI e2e scenario. The scenario seeds a persisted thread with `role=signal` notification and notification-summary DB messages, switches to it through `/threads`, and asserts loaded-history reconstruction for the notification summary count/source/hint plus dismissed, archived, and coalesced pending notification cards.

Focused verification:

```sh
pnpm build:core
pnpm --filter ./mastracode run e2e:test notification-inbox-reload
```

Break validations:

- Dropping reconstructed notification `status` in `packages/core/src/harness/harness.ts` removed the dismissed/archived/pending status text and failed the scenario after rebuilding core.
- Forcing reconstructed notification-summary `pending` to `0` changed the loaded summary title and failed the scenario after rebuilding core.
- Changing `NotificationSummaryComponent` guidance copy away from `notification_inbox` failed the scenario once core dist was rebuilt clean.

The `Chat: Notification inbox signals` tracker row is now validated for TUI-visible behavior: live urgent delivery, active summary + inbox read delivery, CRUD/search transitions, and loaded-history notification/summary signal reload are covered. Backend-only storage migration breadth remains appropriate for core/storage tests.

## 2026-06-03

### Context

Mastra Code hit several user-visible regressions during the Harness v1 migration period:
- New session creation appeared broken for some users.
- Task list state split: the TUI/context showed tasks, but task tools could not find them.
- Model/session state could reload into a broken `No model selected` state.
- Some issues reproduced only after reload from persisted memory/session state.

Slack discussion converged on the idea that this is not one isolated bug. It is a broader testing and state-ownership problem: Mastra Code has many state projections, and Harness v1 changed where some state lives.

### What we verified

We ran Mastra Code tests correctly after building workspace artifacts first:

```sh
pnpm run build:mastracode
pnpm test:mastracode -- --run --reporter=verbose
```

We also checked a pre-Harness v1 baseline in a detached worktree at:

```text
3abcdd2da7c3c5a4b6d49e39beaf29c7d39d0f16 chore(core): rename legacy harness class
```

Result: the existing test suite did not catch a convincing Harness v1 regression. The scariest headless abort timeout already failed before Harness v1, and several other failures were test/env noise.

Comparison docs:
- `explorations/mastracode-testing-recovery/architecture-review/test-audits/mastracode-test-failures-HEAD.md`
- `explorations/mastracode-testing-recovery/architecture-review/test-audits/mastracode-test-failures-pre-harness-v1.md`
- `explorations/mastracode-testing-recovery/architecture-review/test-audits/mastracode-test-failures-pre-harness-v1-vs-HEAD.md`

### Decisions

We decided the recovery plan should have four broad workstreams:

1. Stabilize the existing test baseline.
2. Re-enable Mastra Code tests in CI.
3. Build a graph-like feature map for all intended Mastra Code behavior.
4. Design a real Mastra Code test harness for running the actual TUI with mocked model endpoints.

We also decided to start with an index only. Branch pages should not be created until the approach for that workstream is agreed.

### Branch strategy

This branch should act as the planning base.

Implementation should happen on branches off this branch, preferably as focused stacked PRs. When a PR is ready to merge, rebase/cherry-pick only the implementation commits onto `main` so planning-file commits are not dragged into product/code PRs.

### Next steps

1. Agree on the detailed approach for workstream 1: stabilizing the existing test baseline.
2. Create the first branch page only after that approach is agreed.
3. Then branch from this planning branch for the first implementation PR.

## 2026-06-04

### AIMock exploration

Researched `@copilotkit/aimock@1.28.0` as a candidate mocked-model endpoint for workstream 4. Wrote findings to:

- `explorations/mastracode-testing-recovery/aimock-exploration.md`

Bottom line: AIMock looks promising for a first real MC harness spike if we route MC through an OpenAI-compatible/custom-provider path. It should not be treated as proven for Claude Max/Codex OAuth paths until a spike verifies base URL routing.

### Feature map structure

Agreed that the feature map should be hierarchical Markdown organized by user-visible feature area, not implementation layer. Each concrete feature page should copy `.plan/mastracode-testing-recovery/features/_template.md`, include an origin PR/commit near the top, and use normal relative Markdown links for related features.

Created:

- `.plan/mastracode-testing-recovery/features/README.md`
- `.plan/mastracode-testing-recovery/features/_template.md`

### Skill and feature-map command split

Kept `mastracode-testing-recovery` as a normal skill for the shared operating protocol. Created a goal-enabled custom command for the concrete feature-map job instead of relying on goal-skill loading.

Use:

```text
/goal/map-mc-features [optional scope]
```

Command file:

- `.mastracode/commands/map-mc-features.md`

The command should first list the PR queue from squash-merged `mastracode/` commit history, then process PRs oldest-to-newest. For each PR it reviews the actual originating PR, verifies current source/tests, creates feature pages for new user-visible behavior, and updates earlier pages when later PRs modify documented features.

### Feature map batch 1

Generated `.plan/mastracode-testing-recovery/features/_pr-queue.md` from `git log --reverse --date=short --name-only --pretty=format:'...' -- mastracode`.

Queue summary:

- 493 commits touch `mastracode/`.
- 358 commits have squash-merge PR numbers.
- 251 were initially flagged as likely user-visible or test-relevant and still need verification.

Processed PR [#13218](https://github.com/mastra-ai/mastra/pull/13218), `0e64154f1b` (`MastraCode initial port (#13218)`) as a foundation batch. Wrote initial pages:

- `.plan/mastracode-testing-recovery/features/tui/interactive-chat.md`
- `.plan/mastracode-testing-recovery/features/threads/persistent-conversations.md`
- `.plan/mastracode-testing-recovery/features/models/model-auth-and-modes.md`
- `.plan/mastracode-testing-recovery/features/tools/coding-tools-permissions.md`

These pages are intentionally broad baselines from the initial port. Later PR passes should update them in place when behavior changed, especially for thread reload, model/mode preservation, tool/task rendering, permissions, and streaming-vs-history behavior.

### Feature map structure correction

User feedback: the first 4 feature pages were too long. Stop writing more feature-page content until the index/page shape is tightened.

Updated `.plan/mastracode-testing-recovery/features/README.md` to make the index table the source of truth and updated `_template.md` into a concise card format.

Shrank the 4 existing baseline pages to the concise card format before processing more PRs:

- `.plan/mastracode-testing-recovery/features/tui/interactive-chat.md`
- `.plan/mastracode-testing-recovery/features/threads/persistent-conversations.md`
- `.plan/mastracode-testing-recovery/features/models/model-auth-and-modes.md`
- `.plan/mastracode-testing-recovery/features/tools/coding-tools-permissions.md`

Next queue checkpoint remains PR #13227.

### Feature map PR #13227

Processed PR [#13227](https://github.com/mastra-ai/mastra/pull/13227), `5013f35869` (`MC follow up 1 (#13227)`). Verified current subagent definitions, dynamic workspace behavior, `/subagents` command, and subagent render tests.

Documentation actions:

- Created `.plan/mastracode-testing-recovery/features/subagents/delegation.md`.
- Added the subagents row to the source-of-truth table in `features/README.md`.
- Linked subagents from `features/tools/coding-tools-permissions.md`.

Next queue checkpoint: PR #13231.

### Feature map PR #13231

Processed PR [#13231](https://github.com/mastra-ai/mastra/pull/13231), `6515d301d4` (`More cleanup (#13231)`). Verified current dynamic memory factory, `/om` command wiring, OM handlers/tests, context-aware tools, and gateway heartbeat sync.

Documentation actions:

- Created `.plan/mastracode-testing-recovery/features/memory/observational-memory.md`.
- Added the memory row to the source-of-truth table in `features/README.md`.
- Added #13231 as a later change on model and tools cards.

Next queue checkpoint: PR #13234.

### Feature map PR #13234

Processed PR [#13234](https://github.com/mastra-ai/mastra/pull/13234), `4e28562012` (`MC fixes (#13234)`). PR body was blank; verified via commit diff and current source/tests. Most changes were structural/type/build cleanup, but the durable user-visible behavior is dynamic prompt context and project instruction assembly.

Documentation actions:

- Created `.plan/mastracode-testing-recovery/features/chat/prompt-context.md`.
- Added the prompt-context row to the source-of-truth table in `features/README.md`.
- Marked the rest of #13234 as structural cleanup after source verification.

Next queue checkpoint: PR #13239.

### Feature map PR #13239

Processed PR [#13239](https://github.com/mastra-ai/mastra/pull/13239), `9bbf08e3c2` (`fix(core): use structural typing for ZodLikeSchema to prevent tsc OOM (#13239)`). Verified PR body, commit diff, current core schema references, and representative Mastra Code tool diffs.

Documentation action: skipped feature-page creation. This PR was type/build stability work for `ZodLikeSchema` and caused broad Mastra Code formatting/type churn, but no new or changed user-visible Mastra Code behavior was identified.

Risk/test note: keep Mastra Code tool typechecking/build coverage in mind for workstream 1/CI because this PR existed to prevent TypeScript OOM around `createTool` schema inference.

Next queue checkpoint: PR #13245.

### Feature map PR #13245

Processed PR [#13245](https://github.com/mastra-ai/mastra/pull/13245), `6fdd3d451a` (`Harness primitive (#13245)`). Verified PR metadata, commit stats/name-status, current `HarnessCompat`, `index.ts`, TUI event dispatch, prompt handlers, and tool approval tests.

Documentation actions:

- Updated `.plan/mastracode-testing-recovery/features/tui/interactive-chat.md` for the prototype-to-core Harness event migration.
- Updated `.plan/mastracode-testing-recovery/features/threads/persistent-conversations.md` for core Harness session records.
- Updated `.plan/mastracode-testing-recovery/features/models/model-auth-and-modes.md` for mode/model runtime ownership in core Harness sessions.
- Updated `.plan/mastracode-testing-recovery/features/tools/coding-tools-permissions.md` for core Harness tool/question/plan approval primitives.

No separate Harness feature page was created because the feature map is organized by user-visible behavior, not runtime layer.

Next queue checkpoint: PR #13250.

### Feature map PR #13037 and #13250

Processed PR [#13037](https://github.com/mastra-ai/mastra/pull/13037), `a0b5df263a` (`chore: version packages (alpha) (#13037)`). Verified it was a Changesets alpha version-package PR touching `mastracode/CHANGELOG.md` and `mastracode/package.json`; skipped feature-page creation because it did not introduce or change user-visible Mastra Code behavior.

Processed PR [#13250](https://github.com/mastra-ai/mastra/pull/13250), `4f2e364945` (`fix(mastracode): ESM module resolution error on startup (#13250)`). Verified PR body, commit diff, and current `mastracode/src/lsp/client.ts` imports from `vscode-jsonrpc/node.js`.

Documentation actions:

- Updated `.plan/mastracode-testing-recovery/features/tools/coding-tools-permissions.md` because this fix preserves LSP-backed tool availability and packaged startup.
- Added a missing-test note for packaged startup/import smoke coverage.

Next queue checkpoint: PR #13251, likely version packaging; next review PR after that is #13253.

### Feature map PR #13251 and #13253

Processed PR [#13251](https://github.com/mastra-ai/mastra/pull/13251), `a20fbeff59` (`chore: version packages (alpha) (#13251)`). Verified it was a Changesets alpha version-package PR for the #13250 patch; skipped feature-page creation because it did not introduce or change user-visible behavior beyond the already-mapped #13250 fix.

Processed PR [#13253](https://github.com/mastra-ai/mastra/pull/13253), `1415bcd894` (`fix(schema-compat): fix zodToJsonSchema routing for v3/v4 schemas (#13253)`). Verified PR body, touched Mastra Code tool schema imports, current remaining custom tools, and `packages/schema-compat/src/zod-to-json.ts` / `zod-to-json.test.ts`.

Documentation actions:

- Updated `.plan/mastracode-testing-recovery/features/tools/coding-tools-permissions.md` because this preserves tool-call schema compatibility between source checkout and global install environments.
- Added schema-compat tests and missing end-to-end packaged/source tool schema coverage to the card.

Next queue checkpoint: PR #13252, likely version packaging; next review PR after that is #13255.

### Feature map PR #13252 and #13255

Processed PR [#13252](https://github.com/mastra-ai/mastra/pull/13252), `f090302af0` (`chore: version packages (alpha) (#13252)`). Verified it only touched `mastracode/CHANGELOG.md` and `mastracode/package.json`; skipped feature-page creation.

Processed PR [#13255](https://github.com/mastra-ai/mastra/pull/13255), `d715911c91` (`feat(mastracode): add separate export path for MastraTUI (#13255)`). Verified current `mastracode/package.json` exports `./tui`, `mastracode/tsup.config.ts` builds the `tui` entry, and `mastracode/src/tui/index.ts` exports the public TUI surface.

Documentation actions:

- Updated `.plan/mastracode-testing-recovery/features/tui/interactive-chat.md` because this is a public TUI consumption surface, not a separate runtime feature.
- Added missing built-package import smoke coverage for `mastracode/tui`.

Next queue checkpoint: PR #13257, likely version packaging; next review PR after that is #13305.

### Feature map PR #13257 and #13305

Processed PR [#13257](https://github.com/mastra-ai/mastra/pull/13257), `834b03e500` (`chore: version packages (alpha) (#13257)`). Verified it only touched `mastracode/CHANGELOG.md` and `mastracode/package.json`; skipped feature-page creation.

Processed PR [#13305](https://github.com/mastra-ai/mastra/pull/13305), `b2601234bd` (`fix(memory): improve OM activation chunk selection and safeguards (#13305)`). Verified PR body, current `mastracode/src/agents/memory.ts`, and current core OM threshold/runtime/tests under `packages/memory/src/processors/observational-memory/`.

Documentation actions:

- Updated `.plan/mastracode-testing-recovery/features/memory/observational-memory.md` because this changes OM activation/retention behavior visible as background memory stability.
- Recorded that current Mastra Code defaults differ from the #13305 PR body, so later PRs may have changed the intended `bufferActivation` / `blockAfter` values.
- Updated `_pr-queue.md` status markers: #13257 skipped, #13305 done, #13294 current, #13330 next.

Next queue checkpoint: PR #13294, docs/install instructions; next review PR after that is #13330.

### Feature map PR #13294 and #13330

Processed PR [#13294](https://github.com/mastra-ai/mastra/pull/13294), `a8e92aec01` (`chore(mastracode): Update installation instructions (#13294)`). Verified PR body and current `mastracode/README.md`, `mastracode/package.json`, `mastracode/src/main.ts`, and `mastracode/src/headless.ts`.

Processed PR [#13330](https://github.com/mastra-ai/mastra/pull/13330), `608e156def` (`fix: restore OM status updates and model change events in harness (#13330)`). Verified PR body, current `/om` command callbacks, core harness OM stream chunk handlers, and core OM harness tests.

Documentation actions:

- Created `.plan/mastracode-testing-recovery/features/setup/installation-and-launch.md` because installation/launch is a user-facing entry path.
- Updated `.plan/mastracode-testing-recovery/features/memory/observational-memory.md` for streamed OM lifecycle events and observer/reflector model-switch events.
- Updated feature index and `_pr-queue.md` status markers: #13294 done, #13330 done, #13331 current, #13328 next.

Next queue checkpoint: PR #13331 (`audit-tests` subagent), then PR #13328 (incremental tool argument streaming).

### Feature map PR #13331 and #13328

Processed PR [#13331](https://github.com/mastra-ai/mastra/pull/13331), `3ea22d7703` (`feat(mastracode): add audit-tests subagent (#13331)`). Verified PR body, current `mastracode/src/agents/subagents/audit-tests.ts`, current `mastracode/src/index.ts`, and prompt guidance. Created `features/subagents/audit-tests.md` and noted the current registration gap: the definition exists, but default subagents are only `explore`, `plan`, and `execute`.

Processed PR [#13328](https://github.com/mastra-ai/mastra/pull/13328), `45bb78b70b` (`feat: stream tool arguments incrementally across all tool renderers (#13328)`). Verified current core harness tool-input events/display-state buffers, TUI event dispatch, `handleToolInputDelta()`, tool component `updateArgs()`, and loaded-history rendering from stored final tool calls.

Documentation actions:

- Created `.plan/mastracode-testing-recovery/features/subagents/audit-tests.md`.
- Created `.plan/mastracode-testing-recovery/features/tools/streaming-tool-arguments.md`.
- Updated subagent/tool cards with cross-links and later-change references.
- Updated feature index and `_pr-queue.md` status markers: #13331 done, #13328 done, #13335 current, #13307 next.

Next queue checkpoint: PR #13335 (preserve assistant text across `todo_write`/task tool calls), then PR #13307 (reload auth storage before OpenAI Codex model resolution).

### Feature map PR #13335 and #13307

Processed PR [#13335](https://github.com/mastra-ai/mastra/pull/13335), `7f317fc5e4` (`fix(tui): preserve assistant message text across todo_write tool calls (#13335)`). Verified the current renamed task-tool path in `mastracode/src/tui/handlers/tool.ts`: task mutation tools create a pending tool entry, record `taskToolInsertIndex`, and create a fresh `AssistantMessageComponent` so pre-tool assistant text is not overwritten while post-tool content streams.

Processed PR [#13307](https://github.com/mastra-ai/mastra/pull/13307), `12e4819fe2` (`fix(mastracode): reload auth storage before resolving OpenAI Codex model (#13307)`). Verified current `mastracode/src/agents/model.ts` calls `authStorage.reload()` at the start of `resolveModel()`, then reads OpenAI Codex OAuth/API key credentials from the refreshed store. Existing `model.test.ts` has a generic reload assertion, but no OpenAI Codex-specific stale-credential regression test.

Documentation actions:

- Updated `features/tools/streaming-tool-arguments.md` with #13335 task-tool streaming split behavior and missing regression test.
- Updated `features/models/model-auth-and-modes.md` with #13307 AuthStorage reload behavior and missing Codex stale-credential test.
- Updated `_pr-queue.md` status markers: #13335 done, #13307 done, #13334 current, #13339 next.

Next queue checkpoint: PR #13334 (thread lock config), then PR #13339 (subagent parallel-only and verification guidance).

### Feature map PR #13334 and #13339

Processed PR [#13334](https://github.com/mastra-ai/mastra/pull/13334), `24b80af87d` (`feat(harness): add optional threadLock config for concurrent thread access protection (#13334)`). Verified current MC wiring in `mastracode/src/index.ts`: `HarnessCompat` receives `threadLock` callbacks backed by `acquireThreadLock`/`releaseThreadLock` when cross-process pubsub is unavailable. Verified core Harness behavior in `packages/core/src/harness/harness.ts` and `thread-locking.test.ts`: select/create/switch acquire locks, release old locks after successful acquire, and restore previous lock state on acquire/save failure.

Processed PR [#13339](https://github.com/mastra-ai/mastra/pull/13339), `b322502d4a` (`feat(mastracode): add subagent parallel-only and verification guidance (#13339)`). Verified current `base.ts` includes the parallel-only subagent rule with an `audit-tests` exception. Current `tool-guidance.ts` still has the parallel-only rule but does not mention the audit-tests exception, so the documentation records a help-text consistency gap.

Documentation actions:

- Updated `features/threads/persistent-conversations.md` with #13334 thread-lock ownership, key files, core tests, and missing MC lock-prompt integration test.
- Updated `features/subagents/delegation.md` with #13339 parallel-only guidance ownership and missing consistency test.
- Updated `features/subagents/audit-tests.md` with #13339 as a later change and the remaining registration/help-text gaps.
- Updated `_pr-queue.md` status markers: #13334 done, #13339 done, #13343 current, #13344 next.

Next queue checkpoint: PR #13343 (scope thread auto-resume to current directory), then PR #13344 (todo tools moved to core and renamed to task).

### Feature map PR #13343 and #13344

Processed PR [#13343](https://github.com/mastra-ai/mastra/pull/13343), `2b2e157a09` (`fix: scope thread auto resume to current directory to make worktrees easier to use (#13343)`). Verified current `mastracode/src/tui/setup.ts`: startup thread selection filters by `thread.metadata.projectPath`, falls back to directory birthtime for legacy untagged threads, and retroactively tags resumed untagged threads with the current path.

Processed PR [#13344](https://github.com/mastra-ai/mastra/pull/13344), `c204b632d1` (`refactor: move todo tools to @mastra/core/harness and rename to task (#13344)`). Verified current core task tools in `packages/core/src/harness/tools.ts`, TUI task progress rendering, `task_updated` event handling, prompt `<current-task-list>` injection, permissions, and subagent restrictions.

Documentation actions:

- Updated `features/threads/persistent-conversations.md` with #13343 worktree/current-directory auto-resume behavior and missing startup filtering tests.
- Created `features/tools/task-tracking.md` for the task tool/TUI progress feature.
- Updated `features/tools/coding-tools-permissions.md` and `features/tools/streaming-tool-arguments.md` with #13344 later-change references and links to task tracking.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13343 done, #13344 done, #13345 current, #13311 next.

Next queue checkpoint: PR #13345 (Ctrl+F autocomplete/queued slash commands), then PR #13311 (`/mcp` manager wiring).

### Feature map PR #13345 and #13311

Processed PR [#13345](https://github.com/mastra-ai/mastra/pull/13345), `7aedfb7ff9` (`feat(tui): resolve autocomplete and queue slash commands on Ctrl+F (#13345)`). Verified current Ctrl+F path across `mastracode/src/tui/components/custom-editor.ts`, `setup.ts`, `mastra-tui.ts`, and `handlers/agent-lifecycle.ts`: Ctrl+F accepts slash autocomplete, stores queued actions in FIFO TUI state, and drains queued slash commands through `handleSlashCommand()` after `agent_end`.

Processed PR [#13311](https://github.com/mastra-ai/mastra/pull/13311), `d1b596fb05` (`fix(mastracode): wire mcpManager to TUI so /mcp command works (#13311)`). Verified `mastracode/src/main.ts` passes `mcpManager` into `MastraTUI`, `state.ts` stores it, `mastra-tui.ts` includes it in `SlashCommandContext`, and `commands/mcp.ts` reads `ctx.mcpManager` for status/reload/selector behavior.

Documentation actions:

- Created `features/chat/queued-followups.md` for Ctrl+F queued follow-up and slash-command behavior.
- Created `features/integrations/mcp-status-command.md` for `/mcp` status/reload behavior.
- Updated `features/tui/interactive-chat.md` and `features/tools/coding-tools-permissions.md` with later-change references and links.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13345 done, #13311 done, #13346 current, #13347 next.
- Focused verification passed: `pnpm --filter ./mastracode test --run src/tui/__tests__/mastra-tui-queueing.test.ts src/tui/components/__tests__/custom-editor.test.ts src/tui/__tests__/command-dispatch.test.ts --reporter=dot --bail 1` (66 tests).

Next queue checkpoint: PR #13346 (AGENTS.md instruction loading), then PR #13347 (MCP manager factory refactor).

### Feature map PR #13346 and #13347

Processed PR [#13346](https://github.com/mastra-ai/mastra/pull/13346), `e399dcba4f` (`fix(mastracode): load AGENTS.md instruction files, drop deprecated AGENT.md (#13346)`). Verified current `mastracode/src/agents/prompts/agent-instructions.ts`: static instruction discovery checks `AGENTS.md` before `CLAUDE.md`, no longer checks singular `AGENT.md`, scans global/project/config-dir locations, and feeds ignored static paths into `AgentsMDInjector` through `mastracode/src/index.ts`.

Processed PR [#13347](https://github.com/mastra-ai/mastra/pull/13347), `48d19d89e0` (`refactor: replace MCPManager class with factory function (#13347)`). Verified current `mastracode/src/mcp/manager.ts`: `createMcpManager()` returns the `McpManager` interface with closure-owned config/tools/status/log state; `mastracode/src/agents/tools.ts`, `index.ts`, `main.ts`, and `/mcp` still consume the same manager instance for tools/status/reload/cleanup.

Documentation actions:

- Updated `features/chat/prompt-context.md` with #13346 `AGENTS.md` static instruction loading and missing precedence tests.
- Updated `features/integrations/mcp-status-command.md` and `features/tools/coding-tools-permissions.md` with #13347 manager factory/interface behavior.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13346 done, #13347 done, #13348 current, #13349 next.
- Focused verification passed: `pnpm --filter ./mastracode test --run src/agents/__tests__/prompts.test.ts src/agents/prompts/index.test.ts src/mcp/__tests__/manager.test.ts --reporter=dot --bail 1` (52 tests).

Next queue checkpoint: PR #13348 (tool result token limits), then PR #13349 (OM buffer activation threshold).


### Feature map PR #13348 and #13349

Processed PR [#13348](https://github.com/mastra-ai/mastra/pull/13348), `4137924b3f` (`fix: limit tool result token sizes for view, grep, and web tools (#13348)`). Verified current `mastracode/src/tools/web-search.ts` caps web-search and web-extract output at 2k estimated tokens, while file/search/shell-style workspace output limits now live in `packages/core/src/workspace/tools/output-helpers.ts` with `DEFAULT_MAX_OUTPUT_TOKENS = 2_000`.

Processed PR [#13349](https://github.com/mastra-ai/mastra/pull/13349), `5f1f0fa8a3` (`fix: raise memory buffer activation threshold to prevent aggressive window shrinking (#13349)`). Verified the PR temporarily raised observation `bufferActivation` from 2000 to 4000, but current `mastracode/src/agents/memory.ts` is back to `bufferActivation: 2000` for thread scope; `git blame` shows later OM precision/scope work changed the current defaults.

Documentation actions:

- Updated `features/tools/coding-tools-permissions.md` with #13348 tool-output budget ownership, key files, and missing web-tool truncation test.
- Updated `features/memory/observational-memory.md` with #13349's temporary threshold change and current-default drift risk.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13348 done, #13349 done, #13350 current, #13355 next.

Next queue checkpoint: PR #13350 (TUIState extraction), then PR #13355 (`view_range` directory listing fix).


### Feature map PR #13350 and #13355

Processed PR [#13350](https://github.com/mastra-ai/mastra/pull/13350), `e65ec08031` (`refactor: extract TUI state into dedicated TUIState interface and factory (#13350)`). Verified current `mastracode/src/tui/state.ts` owns the shared `TUIState`, `MastraTUIOptions`, and `createTUIState()` factory defaults, and `mastracode/src/tui/index.ts` exports `createTUIState` / `TUIState` through `mastracode/tui`.

Processed PR [#13355](https://github.com/mastra-ai/mastra/pull/13355), `89b1a4aead` (`fix(mastracode): allow view_range for directory listings (#13355)`). Verified the original fix in deleted `mastracode/src/tools/file-view.ts` allowed `view_range` to slice directory listings and tolerate null range entries. Current source no longer has literal `view_range`; the replacement is split core workspace tools: `read_file` supports file `offset` / `limit`, while `list_files` handles directory trees without offset/limit pagination.

Documentation actions:

- Updated `features/tui/interactive-chat.md` with #13350 shared TUI state/public export behavior and missing `createTUIState()` default-shape tests.
- Updated `features/tools/coding-tools-permissions.md` with #13355's historical directory pagination fix, current split core tool behavior, and missing current pagination-regression coverage.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13350 done, #13355 done, #13354 current, #13353 next.

Next queue checkpoint: PR #13354 (OM continuity at low activation), then PR #13353 (Harness object-parameter refactor/reference docs).


### Feature map PR #13354 and #13353

Processed PR [#13354](https://github.com/mastra-ai/mastra/pull/13354), `78d1c808ad` (`fix(memory): improve OM continuity at low activation (#13354)`). Verified current OM code preserves continuation hints (`currentTask`, `suggestedContinuation`) through observer output, async buffered chunks, activation results, and thread OM metadata. Current degenerate-output handling lives in `packages/memory/src/processors/observational-memory/observer-runner.ts`: retry once, then fail if still degenerate.

Processed PR [#13353](https://github.com/mastra-ai/mastra/pull/13353), `59d30b5d0c` (`refactor(harness): use object parameters for all Harness methods + add reference docs (#13353)`). Verified current `packages/core/src/harness/harness.ts` object-param methods and current Mastra Code call sites in TUI/headless handlers. Also verified `docs/src/content/en/reference/harness/harness-class.mdx` documents object-param examples.

Documentation actions:

- Updated `features/memory/observational-memory.md` with #13354 continuation-hint behavior, state ownership, key files, tests, and stale-hint risk.
- Created `features/integrations/harness-api.md` for #13353's external Harness API/reference-doc surface.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13354 done, #13353 done, #13260 current, #13416 next.

Next queue checkpoint: PR #13260 (likely version-package skip), then PR #13416 (plan mode agent calls `submit_plan`).


### Feature map PR #13260 and #13416

Skipped PR [#13260](https://github.com/mastra-ai/mastra/pull/13260), `e610573a4c` (`chore: version packages (alpha) (#13260)`). Verified via PR metadata and `git show` that Mastra Code changes were `mastracode/CHANGELOG.md` and `mastracode/package.json` version/package churn only; no user-visible feature mapping needed.

Processed PR [#13416](https://github.com/mastra-ai/mastra/pull/13416), `9a3d857436` (`fix(mastracode): plan mode agent now calls submit_plan tool (#13416)`). Verified current source: `plan.ts` requires calling `submit_plan`, `tool-guidance.ts` exposes `submit_plan` only in Plan mode when not denied, core `submitPlanTool` emits `plan_approval_required`, TUI `handlePlanApproval()` resolves approve/reject/goal actions, and `renderExistingMessages()` reconstructs persisted `submit_plan` results as resolved plan cards.

Documentation actions:

- Created `features/goals/plan-approval.md` for Plan-mode `submit_plan` approval and Build/goal handoff behavior.
- Updated `features/chat/prompt-context.md` with #13416's mode-aware tool guidance dependency.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13260 skipped, #13416 done, #13413 current, #13385 next.

Next queue checkpoint: PR #13413 (TUI modularization), then PR #13385 (TS/JS LSP language identifier fix).


### Feature map PR #13413 and #13385

Processed PR [#13413](https://github.com/mastra-ai/mastra/pull/13413), `f08b0bb00b` (`refactor: modularize TUI into focused modules (#13413)`). Verified current source keeps `mastracode/src/tui/mastra-tui.ts` as a thin lifecycle wrapper and routes events through extracted modules: `event-dispatch.ts`, `handlers/*`, `setup.ts`, `render-messages.ts`, `status-line.ts`, and `shell.ts`. No new user-visible feature page needed; this is a structural refactor of the existing interactive chat surface.

Processed PR [#13385](https://github.com/mastra-ai/mastra/pull/13385), `18553c3541` (`fix(mastracode): use correct LSP language identifier for TS/JS files (#13385)`). Verified current core workspace LSP path maps extensions via `getLanguageId()` (`.ts` → `typescript`, `.tsx` → `typescriptreact`, `.js` → `javascript`, `.jsx` → `javascriptreact`) before `notifyOpen()`. The original MC-owned `string-replace-lsp.ts` path no longer exists at HEAD; current active behavior lives in `packages/core/src/workspace/lsp/*` and `tools/lsp-inspect.ts`, with a legacy MC-local language map still present.

Documentation actions:

- Updated `features/tui/interactive-chat.md` with #13413 modularized handler/event/status/shell ownership and routing risk.
- Updated `features/tools/coding-tools-permissions.md` with #13385 LSP language-ID behavior, current core LSP ownership, tests, and missing direct language-mapping coverage.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13413 done, #13385 done, #13384 current, #13376 next.

Next queue checkpoint: PR #13384 (hidden-file directory listings), then PR #13376 (model name in Co-Authored-By commit message).


### Feature map PR #13384 and #13376

Processed PR [#13384](https://github.com/mastra-ai/mastra/pull/13384), `8af03582df` (`fix(mastracode): exclude hidden files from directory listings (#13384)`). Verified the original fix corrected an over-escaped shell `find` pattern in the old MC-owned `file-view.ts` / `file-editor.ts` tools. Current source has migrated directory listing to core workspace: `packages/core/src/workspace/tools/list-files.ts` exposes `showHidden` defaulting false, and `tree-formatter.ts` filters entries whose names start with `.` unless `showHidden` is true. `list-files.test.ts` directly covers default dotfile exclusion and opt-in visibility.

Processed PR [#13376](https://github.com/mastra-ai/mastra/pull/13376), `7429026f6c` (`feat(mastracode): include model name in Co-Authored-By commit message (#13376)`). Verified current prompt path copies `state.currentModelId` into `PromptContext.modelId`, passes it through `buildFullPrompt()`, and formats the Git Safety line as `Co-Authored-By: Mastra Code (<model-id>) <noreply@mastra.ai>` when present, with the old model-less fallback when absent.

Documentation actions:

- Updated `features/tools/coding-tools-permissions.md` with #13384 hidden-file listing behavior, current core ownership, tests, and provider-consistency risk.
- Created `features/git/commit-attribution.md` for #13376 commit attribution behavior and missing direct prompt/commit tests.
- Updated `features/chat/prompt-context.md` with #13376's model-aware commit guidance dependency.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13384 done, #13376 done, #13421 current, #13431 next.

Next queue checkpoint: PR #13421 (interactive onboarding/global settings), then PR #13431 (Codex default model change).


### Feature map PR #13421 and #13431

Processed PR [#13421](https://github.com/mastra-ai/mastra/pull/13421), `27644fbf25` (`feat(mastracode): add interactive onboarding flow and global settings (#13421)`). Verified current source adds first-run `/setup` onboarding through `OnboardingInlineComponent`, provider-filtered mode/OM packs, global `settings.json`, `/models` pack switching/import/edit/share helpers, startup `resolveModelDefaults()` / `resolveOmRoleModel()` plumbing, and live `applyOnboardingResult()` writes to harness state, thread settings, subagent model IDs, and saved settings.

Processed PR [#13431](https://github.com/mastra-ai/mastra/pull/13431), `bb82abe5e9` (`fix(mastracode): default codex model from 5.3 to 5.2 (#13431)`). Verified current source no longer matches that temporary default: `PROVIDER_DEFAULT_MODELS['openai-codex']` and `getAvailableModePacks()` now use `openai/gpt-5.5` for OpenAI plan/build, and `packs.test.ts` asserts the current value.

Documentation actions:

- Created `features/settings/onboarding-and-global-settings.md` for first-run setup, persisted settings, mode packs, OM packs, and YOLO/quiet preference state ownership.
- Updated `features/models/model-auth-and-modes.md` with #13421 pack/settings ownership and #13431 current-default drift.
- Updated `features/memory/observational-memory.md` with #13421 OM pack defaults.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13421 done, #13431 done, #13422 current, #13428 next.

Next queue checkpoint: PR #13422 (ASCII art banner), then PR #13428 (read_file view rendering).


### Feature map PR #13422 and #13428

Processed PR [#13422](https://github.com/mastra-ai/mastra/pull/13422), `d1abce8a51` (`feat(mastracode): Add ASCII art banner header with purple gradient (#13422)`). Verified current source renders a responsive startup banner with `renderBanner(version, appName)`: full `MASTRA CODE` block art for wide terminals, short `MASTRA` block art for medium terminals, and a compact single-line fallback for narrow terminals or custom app names. Current code uses Mastra green gradient stops despite the PR title/body saying purple.

Processed PR [#13428](https://github.com/mastra-ai/mastra/pull/13428), `6f927b2103` (`fix(tui): fix view tool rendering for workspace read_file output (#13428)`). Verified current source remaps core workspace `read_file` to the Mastra Code `view` tool, and `ToolExecutionComponentEnhanced` strips workspace-style `→` line-number separators plus workspace read headers before syntax-highlighted rendering. Current workspace setup no longer exposes raw duplicate `mastra_workspace_*` names for normal tool display; it remaps core workspace tools through `TOOL_NAME_OVERRIDES`.

Documentation actions:

- Created `features/tui/startup-banner.md` for #13422 startup header behavior.
- Updated `features/tui/interactive-chat.md` with banner layout relationship and tests.
- Updated `features/tools/coding-tools-permissions.md` with #13428 view-output rendering behavior and missing expanded-renderer coverage.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13422 done, #13428 done, #13426 current, #13427 next.

Next queue checkpoint: PR #13426 (simplified help commands), then PR #13427 (HarnessDisplayState).


### Feature map PR #13426 and #13427

Processed PR [#13426](https://github.com/mastra-ai/mastra/pull/13426), `5839d227b4` (`feat(mastracode): simplify suggested help commands (#13426)`). Verified current source routes `/help` through `handleHelpCommand()` and `buildHelpText()`, producing compact command, custom command, shell, and keyboard-shortcut sections. Startup layout now points users to `⇧+Tab cycle modes` and `/help info & shortcuts` instead of showing the older long suggested-command list.

Processed PR [#13427](https://github.com/mastra-ai/mastra/pull/13427), `d4701f7e24` (`feat(core): add HarnessDisplayState for UI-agnostic display state (#13427)`). Verified current core Harness owns `HarnessDisplayState`, updates it inside `applyDisplayStateUpdate()` for lifecycle/message/tool/prompt/subagent/OM/task events, emits `display_state_changed` after raw events, and offers coalesced/cloned `subscribeDisplayState()` snapshots through `DisplayStateScheduler`. Mastra Code currently uses this projection for status-line refresh and task/history reconciliation while still handling many raw events directly.

Documentation actions:

- Created `features/tui/help-and-shortcuts.md` for #13426 compact `/help` and startup hint behavior.
- Created `features/integrations/harness-display-state.md` for #13427 display-state API behavior.
- Updated `features/tui/interactive-chat.md`, `features/tui/startup-banner.md`, `features/integrations/harness-api.md`, `features/tools/streaming-tool-arguments.md`, `features/tools/task-tracking.md`, and `features/memory/observational-memory.md` with display-state/help relationships.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13426 done, #13427 done, #13435 current.

Next queue checkpoint: PR #13435 (PostgreSQL opt-in storage backend + libsql settings UI), then PR #13405 (likely version skip).


### Feature map PR #13435 and #13405

Processed PR [#13435](https://github.com/mastra-ai/mastra/pull/13435), `decccfdf65` (`feat(mastracode): add PostgreSQL opt-in storage backend + libsql settings ui (#13435)`). Verified current source resolves storage in priority order: env vars, global `settings.json`, legacy `.mastracode/database.json`, then default local LibSQL. `/settings` now exposes a Storage backend picker for LibSQL/PostgreSQL connection strings, saves the choice, stops the TUI, and requires restart. `createStorage()` tests PostgreSQL on startup and falls back to LibSQL with a warning so the user can still fix settings.

Processed PR [#13405](https://github.com/mastra-ai/mastra/pull/13405), `424bd890be` (`chore: version packages (alpha) (#13405)`). Verified it is alpha package version/CHANGELOG churn for Mastra Code and package metadata only; no feature page needed.

Documentation actions:

- Created `features/settings/storage-backend.md` for storage backend selection, config precedence, fallback behavior, vector-store pairing, and restart/migration risks.
- Updated `features/settings/onboarding-and-global-settings.md` with #13435 storage settings ownership.
- Updated `features/threads/persistent-conversations.md` and `features/memory/observational-memory.md` with storage backend dependencies.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13435 done, #13405 skipped, #13456 current.

Next queue checkpoint: PR #13456 (refresh git branch on thread resume), then PR #13457 (cache dynamic workspace on harness).


### Feature map PR #13456 and #13457

Processed PR [#13456](https://github.com/mastra-ai/mastra/pull/13456), `babdfb23c2` (`feat(mastracode): refresh git branch on thread resume & abbreviate long branch names (#13456)`). Verified current source refreshes the Git branch in `getDynamicInstructions()`, on `thread_changed`, and on agent start/end so resumed threads and branch-changing tool calls do not leave the prompt or TUI footer stale. `status-line.ts` now falls back from full path+branch to branch-only, abbreviated branch, then no directory.

Processed PR [#13457](https://github.com/mastra-ai/mastra/pull/13457), `00f43e8e97` (`fix: cache dynamic workspace on harness after resolution (#13457)`). Verified current core Harness caches dynamic workspace factory results in `buildRequestContext()` and exposes `resolveWorkspace()` for eager command usage. `/skills` and `/skill/<name>` call `resolveWorkspace()` when `getResolvedWorkspace()` has not been populated yet, so skills can be listed before the first message.

Documentation actions:

- Created `features/git/branch-context.md` for live branch prompt/status behavior and missing branch-refresh tests.
- Created `features/integrations/skills-command.md` for `/skills`, `/skill/<name>`, and Harness dynamic workspace resolution.
- Updated `features/chat/prompt-context.md`, `features/tui/interactive-chat.md`, and `features/integrations/harness-api.md` with #13456/#13457 relationships.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13456 done, #13457 done, #13460 current.

Next queue checkpoint: PR #13460 (fdPath file autocomplete), then PR #13442 (Stop/UserPromptSubmit hooks).


### Feature map PR #13460 and #13442

Processed PR [#13460](https://github.com/mastra-ai/mastra/pull/13460), `e9cc208c94` (`fix(mastracode): wire fdPath to enable @ file autocomplete (#13460)`). Verified current source detects `fd` then `fdfind` with `which`/`where`, passes the resolved path as the third `CombinedAutocompleteProvider` argument, and preserves slash/custom/skill autocomplete provider setup. Current tests cover slash/skill autocomplete ordering but do not prove `fdPath` propagation.

Processed PR [#13442](https://github.com/mastra-ai/mastra/pull/13442), `cc62d1b2bb` (`mastracode: trigger Stop and UserPromptSubmit hooks in TUI (#13442)`). Verified current TUI runs `UserPromptSubmit` for non-command initial and interactive prompts before sending, removes optimistic messages when blocked, and runs `Stop` on `agent_end` reasons `complete`, `aborted`, and `error`. Also verified dynamic tool hooks still wrap `PreToolUse` / `PostToolUse` in `agents/tools.ts`.

Documentation actions:

- Created `features/tui/file-autocomplete.md` for `@` file references and `fd`/`fdfind` detection.
- Created `features/integrations/lifecycle-hooks.md` for hook config, blocking semantics, TUI lifecycle wiring, and tool hook wrapping.
- Updated `features/tui/interactive-chat.md`, `features/integrations/skills-command.md`, and `features/tools/coding-tools-permissions.md` with #13460/#13442 relationships.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13460 done, #13442 done, #13487 current.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/agents/tools.test.ts --reporter=dot` passed (4 tests).
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/setup-keyboard-shortcuts.test.ts --reporter=dot --bail 1` failed on the known stale `/github` autocomplete expectation (`sync` now appears before `debug`).
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/mastra-tui-hooks.test.ts src/agents/tools.test.ts --reporter=dot` could not execute the hooks file because its `node:child_process` mock omits `execFile`, now imported via GitHub command wiring.
- An accidental broad `pnpm --filter ./mastracode test -- --run ...` reproduced the existing 5 failed files / 6 failed tests baseline; no code changes were made in this batch.

Next queue checkpoint: PR #13487 (terminal color theme), then PR #13494 (supported providers doc link).


### Feature map PR #13487 and #13494

Processed PR [#13487](https://github.com/mastra-ai/mastra/pull/13487), `9ef0b440ed` (`feat(mastracode): inherit terminal color theme for light/dark mode support (#13487)`). Verified current source resolves theme at startup from `MASTRA_THEME`, persisted `settings.preferences.theme`, OSC 11 terminal background detection, `COLORFGBG`, then dark fallback. `applyThemeMode()` switches dark/light palettes, computes contrast-adapted brand/surface colors, writes OSC 10 foreground color for unstyled text, and `restoreTerminalForeground()` resets it on exit.

Processed PR [#13494](https://github.com/mastra-ai/mastra/pull/13494), `5c6bf27b79` (`fix(mastracode): Update documentation link for supported providers`). Verified current onboarding provider warning points to `https://mastra.ai/models` for supported providers/API key env vars.

Documentation actions:

- Created `features/tui/terminal-theme.md` for `/theme`, auto-detection, global theme state, contrast utilities, and terminal OSC side effects.
- Updated `features/settings/onboarding-and-global-settings.md` with theme preference ownership and the supported-provider docs-link fix.
- Updated `features/tui/interactive-chat.md`, `features/tui/help-and-shortcuts.md`, `features/README.md`, and `_pr-queue.md` status markers: #13487 done, #13494 done, #13493 current.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/theme-contrast.test.ts src/onboarding/__tests__/settings.test.ts src/onboarding/__tests__/packs.test.ts --reporter=dot` passed (3 files / 68 tests).

Next queue checkpoint: PR #13493 (append unused slash-command args), then PR #13500 (allow onboarding with API keys only).


### Feature map PR #13493 and #13500

Processed PR [#13493](https://github.com/mastra-ai/mastra/pull/13493), `434ad50157` (`fix(mastracode): append unused arguments to slash command output (#13493)`). Verified current `processSlashCommand()` appends raw user args as an `ARGUMENTS:` block only when the template has no `$ARGUMENTS` or `$1+` placeholders, and does the append after shell/file expansion so raw args are not executed. The current regex treats `$0` as literal shell/prose text, not a positional placeholder.

Processed PR [#13500](https://github.com/mastra-ai/mastra/pull/13500), `47cb0a8962` (`fix(mastracode): allow onboarding to proceed with API keys only (#13500)`). Verified current onboarding computes `hasProviderAccess` from the full provider-access object, passes it into `OnboardingInlineComponent`, and shows API-key/OAuth copy instead of blocking users who have API keys but no OAuth login or built-in pack.

Documentation actions:

- Updated `features/chat/queued-followups.md` for custom slash-command argument preservation and missing `$0`/append tests.
- Updated `features/settings/onboarding-and-global-settings.md` and `features/models/model-auth-and-modes.md` for API-key-only onboarding access.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13493 done, #13500 done, #13503 current.

Next queue checkpoint: PR #13503 (theme export startup crash), then PR #13505 (Claude Max OAuth ToS warning).


### Feature map PR #13503 and #13505

Processed PR [#13503](https://github.com/mastra-ai/mastra/pull/13503), `cc26bff512` (`fix(mastracode): remove individual theme function exports to fix startup crash (#13503)`). Verified current `theme.ts` keeps `fg`, `bg`, `bold`, `italic`, `dim`, `getTheme`, and `setTheme` as internal helpers exposed through the exported `theme` object. `tui/index.ts` exports `theme` and mode/palette helpers, but not the direct styling functions that caused the original startup crash.

Processed PR [#13505](https://github.com/mastra-ai/mastra/pull/13505), `11def4789e` (`feat(mastracode): add Claude Max OAuth ToS warning (#13505)`). Verified the original warning flow no longer exists in current source: no `claude-max-warning` files remain, `/login` and onboarding go straight through auth-mode selection + login dialog, and `CHANGELOG.md` records later #14605 removing the Anthropic OAuth warning prompt/settings.

Documentation actions:

- Updated `features/tui/terminal-theme.md` for the verified single `theme` object helper API and startup-crash regression risk.
- Updated `features/settings/onboarding-and-global-settings.md` and `features/models/model-auth-and-modes.md` to record the historical Claude Max OAuth warning and current removal.
- Updated `features/README.md` and `_pr-queue.md` status markers: #13503 done, #13505 done, #13476 current.

Next queue checkpoint: PR #13476 (OM buffering precision), then PR #13490 (Codex reasoning effort).


### Feature map PR #13476 and #13490

Processed PR [#13476](https://github.com/mastra-ai/mastra/pull/13476), `cb9f921320` (`fix: observational memory buffering precision (#13476)`). Verified current OM runtime and storage keep retained-context safeguards for buffered activation, interpret `blockAfter` as a threshold multiplier below 100 and absolute count at/above 100, trigger mid-step activation when buffered thresholds are crossed, and disable async buffering for resource scope in Mastra Code defaults.

Processed PR [#13490](https://github.com/mastra-ai/mastra/pull/13490), `d7ad237020` (`feat(mastracode): wire reasoning effort for OpenAI Codex models (#13490)`). Verified current OpenAI Codex provider maps thinking levels to `reasoningEffort`, enforces a minimum `low` level for GPT-5 Codex when requested `off`, and `/think` supports direct args, status, and an inline selector.

Documentation actions:

- Updated `features/memory/observational-memory.md` with #13476 activation precision, mid-step activation, storage-adapter sync risks, and current Mastra Code defaults.
- Created `features/models/thinking-and-reasoning.md` for `/think`, `--thinking-level`, Codex provider mapping, and OpenAI pack auto-enable behavior.
- Updated `features/models/model-auth-and-modes.md`, `features/README.md`, and `_pr-queue.md` status markers: #13476 done, #13490 done, #13508 current.

Verification:

- `pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/mid-loop-observation.test.ts --reporter=dot --bail 1` passed (7 tests).
- `pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/observational-memory.test.ts --reporter=dot --bail 1 -t "blockAfter|buffered activation|activation"` passed (56 selected tests).
- `pnpm --filter ./mastracode exec vitest run src/__tests__/codex-model-routing.test.ts src/headless.test.ts --reporter=dot --bail 1` passed (49 tests).
- Targeted `model.test.ts` Codex cases passed after unsetting leaked API-key env vars; broad `model.test.ts -t "Codex|OpenAI|thinking"` still hits the known env-leak failure in `getOpenAIApiKey`.

Next queue checkpoint: PR #13508 (Claude Max OAuth warning strengthening), then PR #13455 (likely version-package skip).


### Feature map PR #13508 and #13455

Processed PR [#13508](https://github.com/mastra-ai/mastra/pull/13508), `089b114eb9` (`fix(mastracode): strengthen Claude Max OAuth risk warning`). Verified the PR only strengthened the warning copy added by #13505: it changed `CLAUDE_MAX_OAUTH_WARNING_MESSAGE` and docs text to mention reported bans and Terms of Service risk. Current source no longer has the warning module or modal flow because #14605 removed it; login/setup now proceed through auth-mode selection and the login dialog.

Processed PR [#13455](https://github.com/mastra-ai/mastra/pull/13455), `6302b3ae7c` (`chore: version packages (alpha)`). Verified it only touched `mastracode/CHANGELOG.md` and `mastracode/package.json` under Mastra Code, so it is a version-package skip.

Documentation actions:

- Updated `features/settings/onboarding-and-global-settings.md` and `features/models/model-auth-and-modes.md` with #13508 as historical warning-copy strengthening that is no longer active at HEAD.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13508 done, #13455 skipped, #13519 current.

Verification:

- `gh pr view 13508 --json number,title,body,author,mergedAt,url,files,commits` and `git show 089b114e...` verified the warning-copy-only diff.
- Current source search verified `auth/claude-max-warning.ts` is gone and `/login` no longer gates Anthropic OAuth on a Claude Max warning.
- `gh pr view 13455 --json number,title,body,author,mergedAt,url,files,commits` and `git show 6302b3ae7c -- mastracode` verified the version-only skip.

Next queue checkpoint: PR #13519 (tool approval resume for standalone agents), then PR #13525 (Mastra Code docs move).


### Feature map PR #13519 and #13525

Processed PR [#13519](https://github.com/mastra-ai/mastra/pull/13519), `b03c0e0389` (`fix: tool approval resume failing for standalone agents`). Verified the current core fix has two parts: `Harness.init()` creates an internal Mastra instance with configured storage and adds standalone agents to it, and workflow snapshot persistence serializes request context through `serializeRequestContext()` so functions/circular runtime objects do not break JSON persistence.

Processed PR [#13525](https://github.com/mastra-ai/mastra/pull/13525), `439dd1a1c9` (`chore(docs): Move Mastra Code docs, add Alpha notice to Harness`). Verified main-site Mastra Code docs were redirected to `https://code.mastra.ai/`, the Harness reference sidebar is Alpha-badged, and `mastracode/README.md` points users at the standalone Code docs site.

Documentation actions:

- Updated `features/integrations/harness-api.md` with #13519 internal Mastra/storage registration, request-context serialization, approval resume tests, #13525 docs redirects, and Alpha Harness docs status.
- Updated `features/tools/coding-tools-permissions.md` with #13519 approval-resume snapshot ownership, tests, and risks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13519 done, #13525 done, #13530 current.

Verification:

- Current source checked: `packages/core/src/harness/harness.ts`, `packages/core/src/workflows/default.test.ts`, `packages/core/src/agent/__tests__/tool-approval-standalone-repro.test.ts`, `docs/vercel.json`, and `mastracode/README.md`.
- Focused tests planned for commit verification: core standalone approval resume, workflow request-context serialization, and MC LibSQL approval resume.

Next queue checkpoint: PR #13530 (Mastra Code docs move follow-up), then PR #13512 (models pack UX).


### Feature map PR #13530 and #13512

Processed PR [#13530](https://github.com/mastra-ai/mastra/pull/13530), `0533de8a34` (`chore(docs): Move mastra-code docs (#13530)`). Verified this was a documentation-location follow-up: Mastra Code docs moved from the temporary `mastracode/docs/` directory into `docs/src/mastra-code/`; current HEAD no longer has `mastracode/docs/`, and the product README points to the standalone Code docs site.

Processed PR [#13512](https://github.com/mastra-ai/mastra/pull/13512), `191e5bd29b` (`fix: unify /models pack flow and improve custom pack editing UX (#13512)`). Verified current `/models` opens the pack selector directly, `/models:pack` is intentionally unknown, custom pack actions include activate/edit/delete/share/import, targeted edit preserves untouched mode models, rename/delete clean up stale pack IDs, and model use counts are persisted through Harness `switchModel()` for selector sorting.

Documentation actions:

- Updated `features/models/model-auth-and-modes.md` for the unified `/models` flow, custom pack CRUD/import/share behavior, model use-count ownership, and reload risks around stale pack IDs.
- Updated `features/settings/onboarding-and-global-settings.md` for #13512 custom-pack settings ownership and missing real-overlay tests.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13530 done, #13512 done, #13526 current.

Verification:

- Current source checked: `mastracode/src/tui/commands/models-pack.ts`, `mastracode/src/onboarding/settings.ts`, `mastracode/src/tui/components/model-selector.ts`, `mastracode/src/tui/__tests__/command-dispatch.test.ts`, and `mastracode/VERIFICATION.md`.
- Current tests checked: `mastracode/src/tui/commands/__tests__/models-pack.test.ts` and `mastracode/src/onboarding/__tests__/settings.test.ts`.

Next queue checkpoint: PR #13526 (edit tool path resolution), then PR #13557 (persist approved plans to disk).


### Feature map PR #13526 and #13557

Processed PR [#13526](https://github.com/mastra-ai/mastra/pull/13526), `85b54c0a4f` (`fix(mastracode): resolve edit tool paths like execute_command`). Verified the original Mastra Code-local edit tools were later replaced by core workspace tools, and current behavior is owned by `LocalFilesystem` / workspace tool wrappers: absolute paths inside the base path are allowed, absolute paths outside are blocked, and absolute-looking project paths such as `/src/app.ts` get a concrete relative-path hint only when that hint is safe.

Processed PR [#13557](https://github.com/mastra-ai/mastra/pull/13557), `15f4da196c` (`feat(plans): persist approved plans to disk`). Verified `handlePlanApproval()` saves approved plans best-effort through `savePlanToDisk()` before resolving approval; files are written as timestamped Markdown under app data `plans/<resourceId>/` or `MASTRA_PLANS_DIR`, with slug fallback to `untitled`.

Documentation actions:

- Updated `features/tools/coding-tools-permissions.md` with #13526 path-resolution ownership, current core workspace key files/tests, and path-semantics risk.
- Updated `features/goals/plan-approval.md` with #13557 approved-plan file persistence behavior, state ownership, key files, tests, and risk.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13526 done, #13557 done, #13560 current.

Verification:

- Current source checked: `packages/core/src/workspace/filesystem/local-filesystem.ts`, `packages/core/src/workspace/filesystem/local-filesystem.test.ts`, `packages/core/src/workspace/tools/edit-file.ts`, `packages/core/src/workspace/tools/ast-edit.ts`, `packages/core/src/workspace/tools/tools.ts`, `mastracode/src/tui/handlers/prompts.ts`, `mastracode/src/utils/plans.ts`, `mastracode/src/utils/__tests__/save-plan.test.ts`, and plan-persistence docs in `mastracode/README.md` / `docs/src/mastra-code`.
- PR metadata checked with `gh pr view 13526 --json number,title,body,author,mergedAt,url,files,commits` and `gh pr view 13557 --json number,title,body,author,mergedAt,url,files,commits`.
- Focused tests passed: `pnpm --filter ./packages/core test -- --run src/workspace/filesystem/local-filesystem.test.ts src/workspace/tools/__tests__/edit-file.test.ts --reporter=dot --bail 1` (2 files / 131 tests) and `pnpm --filter ./mastracode exec vitest run src/utils/__tests__/save-plan.test.ts --reporter=dot --bail 1` (1 file / 6 tests).
- Accidental `pnpm --filter ./mastracode test -- --run src/utils/__tests__/save-plan.test.ts --reporter=dot --bail 1` expanded to the full package suite and reproduced the known 5 failing files / 6 failing tests baseline.

Next queue checkpoint: PR #13560 (non-fatal `ERR_STREAM_DESTROYED`), then PR #13563 (Codex OM/stream compatibility).


### Feature map PR #13560 and #13563

Processed PR [#13560](https://github.com/mastra-ai/mastra/pull/13560), `3b56d782fa` (`fix: handle ERR_STREAM_DESTROYED as non-fatal in global error handlers`). Verified `main.ts` ignores `ERR_STREAM_DESTROYED` in both `uncaughtException` and `unhandledRejection` handlers, while `error-classification.ts` keeps matching narrow by walking bounded cause chains and `AggregateError.errors`.

Processed PR [#13563](https://github.com/mastra-ai/mastra/pull/13563), `9311c17d7a` (`fix: make Codex models work with OM and mastracode streams`). Verified current source passes request context and abort signals through observer/reflector streams, resolves OM observer/reflector models with Codex OAuth remapping enabled, shapes Codex provider options for reasoning/tool use, and aborts the active harness stream on OM observation/buffering failures.

Documentation actions:

- Updated `features/setup/installation-and-launch.md` with #13560 global error classification behavior and tests.
- Updated `features/memory/observational-memory.md` with #13563 Codex-aware OM model routing, request-context propagation, and OM failure abort behavior.
- Updated `features/models/thinking-and-reasoning.md` with #13563 Codex middleware/OM compatibility notes.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13560 done, #13563 done, #13564 current.

Verification:

- Current source checked: `mastracode/src/main.ts`, `mastracode/src/error-classification.ts`, `mastracode/src/__tests__/stream-destroyed-error.test.ts`, `mastracode/src/agents/model.ts`, `mastracode/src/agents/memory.ts`, `mastracode/src/providers/openai-codex.ts`, `packages/core/src/harness/harness.ts`, `packages/core/src/harness/om-failure-abort.test.ts`, and `packages/memory/src/processors/observational-memory/{observer-runner.ts,reflector-runner.ts,observational-memory.ts}`.
- Current tests checked: `packages/memory/src/processors/observational-memory/__tests__/abort-signal.test.ts`, `packages/core/src/harness/om-failure-abort.test.ts`, `mastracode/src/__tests__/codex-model-routing.test.ts`, and `mastracode/src/__tests__/stream-destroyed-error.test.ts`.
- Focused tests passed: `pnpm --filter ./mastracode exec vitest run src/__tests__/stream-destroyed-error.test.ts src/__tests__/codex-model-routing.test.ts --reporter=dot --bail 1` (2 files / 20 tests), `pnpm --filter ./packages/core test -- --run src/harness/om-failure-abort.test.ts --reporter=dot --bail 1` (1 file / 2 tests), and `pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/abort-signal.test.ts --reporter=dot --bail 1` (1 file / 5 tests).

Next queue checkpoint: PR #13564 (extraTools wiring), then PR #13566 (model API-key detection).


### Feature map PR #13564 and #13566

Processed PR [#13564](https://github.com/mastra-ai/mastra/pull/13564), `675a6d717f` (`fix(mastracode): wire extraTools into tool builder and filter denied tools (#13564)`). Verified `createDynamicTools()` now receives config `extraTools`, supports record or request-context function forms, refuses to let extra tools overwrite built-ins, applies disabled-tool and per-tool deny filtering, and passes `deniedTools` into prompt guidance so runtime and instructions stay aligned.

Processed PR [#13566](https://github.com/mastra-ai/mastra/pull/13566), `dd32e1e7a2` (`fix(mastracode): detect API keys for all registry providers in setup flow (#13566)`). Verified startup and runtime provider access now scan registry `apiKeyEnvVar` entries instead of only the original hardcoded providers, so API-key-only providers such as Groq/Mistral can satisfy setup/model access checks.

Documentation actions:

- Updated `features/tools/coding-tools-permissions.md` with #13564 extraTools ownership, denied-tool prompt/runtime filtering, and merge-order risks.
- Updated `features/models/model-auth-and-modes.md` and `features/settings/onboarding-and-global-settings.md` with #13566 provider-registry API-key detection and missing non-hardcoded-provider tests.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13564 done, #13566 done, #13598 current.

Verification:

- Current source checked: `mastracode/src/agents/tools.ts`, `mastracode/src/agents/prompts/tool-guidance.ts`, `mastracode/src/agents/prompts/index.ts`, `mastracode/src/agents/extra-tools.test.ts`, `mastracode/src/index.ts`, `mastracode/src/tui/mastra-tui.ts`, `mastracode/src/tui/commands/models-pack.ts`, `mastracode/src/onboarding/packs.ts`, and `mastracode/src/onboarding/onboarding-inline.ts`.
- PR metadata checked with `gh pr view 13564 --json number,title,body,author,mergedAt,url,files,commits` and `gh pr view 13566 --json number,title,body,author,mergedAt,url,files,commits`.
- Focused tests passed: `pnpm --filter ./mastracode exec vitest run src/agents/extra-tools.test.ts src/onboarding/__tests__/packs.test.ts src/tui/commands/__tests__/models-pack.test.ts --reporter=dot --bail 1` (3 files / 39 tests).

Next queue checkpoint: PR #13598 (rejected-plan visibility), then PR #13600 (Anthropic API-key fallback).


### Feature map PR #13598 and #13600

Processed PR [#13598](https://github.com/mastra-ai/mastra/pull/13598), `e37c95493f` (`fix: keep submitted plan visible when requesting changes (#13598)`). Verified `PlanApprovalInlineComponent.switchToFeedbackMode()` now clears and rebuilds the inline card with the plan header and plan content before showing the feedback input, so users can reference the submitted plan while requesting changes.

Processed PR [#13600](https://github.com/mastra-ai/mastra/pull/13600), `43187ad783` (`feat(mastracode): support Anthropic API key as fallback auth for model resolution (#13600)`). Verified current `resolveModel()` prefers explicit Anthropic OAuth, then stored/env Anthropic API key, then falls back to the OAuth provider prompt path; docs now describe OAuth as primary and API keys as fallback.

Documentation actions:

- Updated `features/goals/plan-approval.md` with #13598 feedback-mode plan retention, state ownership, tests, and mode-rebuild risk.
- Updated `features/models/model-auth-and-modes.md` with #13600 Anthropic auth priority, API-key fallback ownership, tests, and priority-drift risk.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13598 done, #13600 done, #13556 current.

Verification:

- Current source checked: `mastracode/src/tui/components/plan-approval-inline.ts`, `mastracode/src/tui/components/__tests__/plan-approval-inline.test.ts`, `mastracode/src/agents/model.ts`, `mastracode/src/agents/__tests__/model.test.ts`, `mastracode/src/providers/claude-max.ts`, and `mastracode/README.md`.
- PR metadata checked with `gh pr view 13598 --json number,title,body,author,mergedAt,url,files,commits` and `gh pr view 13600 --json number,title,body,author,mergedAt,url,files,commits`.
- Focused tests passed with env API keys unset: `env -u MASTRA_GATEWAY_API_KEY -u ANTHROPIC_API_KEY -u OPENAI_API_KEY pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/plan-approval-inline.test.ts src/agents/__tests__/model.test.ts --reporter=dot --bail 1` (2 files / 41 tests).

Next queue checkpoint: PR #13556 (Quiet mode), then PR #13609 (assistant text preservation + web-search fallback).


### Feature map PR #13556 and #13609

Processed PR [#13556](https://github.com/mastra-ai/mastra/pull/13556), `c6c5376cb2` (`feat: add Quiet mode setting for subagent output collapse (#13556)`). Verified current source has persisted `settings.preferences.quietMode`, `quietModeMaxToolPreviewLines`, and `onboarding.quietModePreferenceSelected`; startup copies those settings into `TUIState`; `/settings` exposes Quiet mode plus preview-line choices; live and loaded-history tool renderers apply compact quiet display. Current source appears later-polished versus the original #13556 wording: subagents receive `expandOnComplete: state.quietMode`, while the settings copy still mentions completed subagent collapse.

Processed PR [#13609](https://github.com/mastra-ai/mastra/pull/13609), `ebab49855b` (`fix: preserve assistant text after tool updates and add openai web_search fallback (#13609)`). Verified `handleMessageUpdate()` and `handleMessageEnd()` only update the streaming assistant component when trailing post-boundary content exists (or final abort/error state needs rendering), avoiding blanking previous assistant text after tool-result-only chunks. Verified `createDynamicTools()` adds OpenAI native `web_search` via `createOpenAI({}).tools.webSearch()` when Tavily is absent and the current model starts with `openai/`.

Documentation actions:

- Added `features/tui/quiet-mode.md` covering Quiet mode settings, rollout state, compact tool/task/subagent rendering, tests, and current behavior risks.
- Updated `features/tui/interactive-chat.md` with #13609 assistant streaming text preservation.
- Updated `features/tools/coding-tools-permissions.md` with #13609 OpenAI native web-search fallback and prompt-guidance parity risk.
- Updated `features/subagents/delegation.md`, `features/tools/task-tracking.md`, `features/settings/onboarding-and-global-settings.md`, `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13556 done, #13609 done, #13574 current.

Verification:

- Current source checked: `mastracode/src/onboarding/settings.ts`, `mastracode/src/tui/components/settings.ts`, `mastracode/src/tui/mastra-tui.ts`, `mastracode/src/tui/state.ts`, `mastracode/src/tui/handlers/tool.ts`, `mastracode/src/tui/render-messages.ts`, `mastracode/src/tui/components/tool-execution-enhanced.ts`, `mastracode/src/tui/components/subagent-execution.ts`, `mastracode/src/tui/handlers/message.ts`, and `mastracode/src/agents/tools.ts`.
- Tests identified/read: `mastracode/src/onboarding/__tests__/settings.test.ts`, `mastracode/src/tui/components/__tests__/subagent-execution.test.ts`, `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts`, `mastracode/src/tui/handlers/__tests__/message.test.ts`, and `mastracode/src/agents/tools.test.ts`.
- PR metadata checked with `gh pr view 13556 --json number,title,body,author,mergedAt,url,files,commits` and `gh pr view 13609 --json number,title,body,author,mergedAt,url,files,commits`.
- Focused tests passed: `pnpm --filter ./mastracode exec vitest run src/onboarding/__tests__/settings.test.ts src/tui/components/__tests__/subagent-execution.test.ts src/tui/components/__tests__/tool-execution-enhanced.test.ts src/tui/handlers/__tests__/message.test.ts src/agents/tools.test.ts --reporter=dot --bail 1` (5 files / 120 tests).

Next queue checkpoint: PR #13574 (file attachments), then PR #13605 (`/fix-issue` and `/report-issue`).


### Feature map PR #13574 and #13605

Processed PR [#13574](https://github.com/mastra-ai/mastra/pull/13574), `276246e0b9` (`feat(harness): file attachment support with filename preservation and text file handling`). Verified current Harness API accepts `sendMessage({ content, files })`, converts text/json attachments into filename-labeled fenced text, preserves binary file parts with `mediaType`/`filename`, and rehydrates persisted file/image content through signal and message-list adapters. Current adapter behavior: AIV4 emits file parts through `experimental_attachments`; AIV5 normalizes URL/data-URI file parts and avoids duplicate legacy attachment output.

Processed PR [#13605](https://github.com/mastra-ai/mastra/pull/13605), `829a09641d` (`feat(mastracode): add /fix-issue and /report-issue commands`). Verified current HEAD only exposes `/report-issue`; `/fix-issue` was removed by commit `079d9d4914` inside the same PR. `/report-issue` gates on model selection, creates a thread when `pendingNewThread` is true, injects a guided issue-reporting prompt, instructs duplicate search through `gh issue list` / `gh search issues`, requires user approval before `gh issue create`, and uses the `mastra-ai/mastra` repo plus `mastracode` label.

Documentation actions:

- Added `features/chat/file-attachments.md` for Harness attachment input, filename preservation, adapter conversion, and missing direct Harness tests.
- Added `features/integrations/github-issue-reporting.md` for `/report-issue`, stale `/fix-issue` title mismatch, GitHub CLI side effects, and prompt-driven approval risk.
- Updated `features/README.md`, `_pr-queue.md`, `tui/help-and-shortcuts.md`, `tui/interactive-chat.md`, `chat/prompt-context.md`, `chat/queued-followups.md`, `tools/coding-tools-permissions.md`, `handoff.md`, and this history entry. Queue status: #13574 done, #13605 done, #13437 current.

Verification:

- Current source checked: `packages/core/src/harness/harness.ts`, `packages/core/src/harness/types.ts`, `packages/core/src/agent/message-list/adapters/AIV4Adapter.ts`, `packages/core/src/agent/message-list/adapters/AIV5Adapter.ts`, `packages/core/src/agent/__tests__/agent-signals.test.ts`, `packages/core/src/agent/message-list/adapters/AIV5Adapter-file-ui-part.test.ts`, `packages/core/src/agent/message-list/prompt/attachments-to-parts.test.ts`, `mastracode/src/tui/commands/report-issue.ts`, `mastracode/src/tui/command-dispatch.ts`, `mastracode/src/tui/setup.ts`, and `mastracode/src/tui/components/help-overlay.ts`.
- PR metadata checked with `gh pr view 13574 --json number,title,body,author,mergedAt,url,files,commits` and `gh pr view 13605 --json number,title,body,author,mergedAt,url,files,commits`.
- Focused core tests passed: `pnpm --filter ./packages/core exec vitest run src/agent/__tests__/agent-signals.test.ts src/agent/message-list/adapters/AIV5Adapter-file-ui-part.test.ts src/agent/message-list/prompt/attachments-to-parts.test.ts --reporter=dot --bail 1` (3 files / 94 tests).
- Focused Mastra Code tests passed: `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/command-dispatch.test.ts src/tui/components/__tests__/help-overlay.test.ts --reporter=dot --bail 1` (2 files / 26 tests).

Next queue checkpoint: PR #13437 (workspace tools with TUI streaming), then PR #13682 (`/custom-providers`).


### Feature map PR #13437 and #13682

Processed PR [#13437](https://github.com/mastra-ai/mastra/pull/13437), `e9476527fd` (`feat(mastracode): switch to workspace tools with TUI streaming [COR-511]`). Verified current source has file/list/search/edit/write/LSP/shell/process tools supplied by core `Workspace` rather than `createDynamicTools()`. `getDynamicWorkspace()` builds `Workspace` with `LocalFilesystem`, `LocalSandbox`, skill/allowed paths, plan-mode write-tool disabling, LSP config from settings plus package-runner detection, and reusable workspace IDs keyed by canonical project path. MC dynamic tools now only add non-workspace tools like `request_access`, notification inbox, web search/extract, MCP, extraTools, and hook wrappers. TUI renderer has workspace-specific output handling for view previews, tree summaries, edit diagnostics, and LSP diagnostics.

Processed PR [#13682](https://github.com/mastra-ai/mastra/pull/13682), `ee9c8df644` (`feat(mastracode): add /custom-providers command for custom OpenAI-compatible providers`). Verified `/custom-providers` modal CRUD at HEAD: provider name/url/API key, model add/remove, edit/delete, duplicate prevention, URL validation, and immediate manage view after create. Settings parsing trims/sanitizes entries, strips duplicate provider prefixes from model names, and persists optional API keys. `resolveModel()` routes custom provider IDs through `ModelRouterLanguageModel` before gateway/built-in logic, so custom provider collisions intentionally win. Harness `customModelCatalogProvider` adds custom models to `listAvailableModels()` for `/models` and `/om` selectors.

Documentation actions:

- Added `features/tools/workspace-tools.md` for core Workspace-backed coding tools, workspace caching, plan-mode tool disabling, LSP config, TUI streaming/rendering, and missing integration tests.
- Added `features/models/custom-providers.md` for `/custom-providers`, settings persistence, model routing/catalog integration, and missing modal/catalog tests.
- Updated `features/README.md`, `_pr-queue.md`, `tools/coding-tools-permissions.md`, `tools/streaming-tool-arguments.md`, `integrations/skills-command.md`, `models/model-auth-and-modes.md`, `settings/onboarding-and-global-settings.md`, `tui/help-and-shortcuts.md`, `handoff.md`, and this history entry. Queue status: #13437 done, #13682 done, #13690 current.

Verification:

- Current source checked: `mastracode/src/agents/workspace.ts`, `mastracode/src/agents/tools.ts`, `mastracode/src/tool-names.ts`, `mastracode/src/tui/components/tool-execution-enhanced.ts`, `mastracode/src/tui/commands/custom-providers.ts`, `mastracode/src/onboarding/settings.ts`, `mastracode/src/agents/model.ts`, `mastracode/src/index.ts`, `packages/core/src/harness/harness.ts`, `packages/core/src/harness/types.ts`, and `packages/core/src/workspace/tools/*`.
- Tests identified/read: `packages/core/src/harness/workspace-resolution.test.ts`, `packages/core/src/harness/subagent-workspace-integration.test.ts`, `packages/core/src/workspace/tools/__tests__/*.test.ts`, `mastracode/src/agents/__tests__/workspace-env.test.ts`, `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts`, `mastracode/src/tui/commands/__tests__/custom-providers.test.ts`, `mastracode/src/onboarding/__tests__/settings.test.ts`, `mastracode/src/agents/__tests__/model.test.ts`, and `mastracode/src/tui/__tests__/command-dispatch.test.ts`.
- PR metadata checked with `gh pr view 13437 --json number,title,body,author,mergedAt,url,files,commits` and `gh pr view 13682 --json number,title,body,author,mergedAt,url,files,commits`.
- Focused MC tests: first run including `src/agents/__tests__/model.test.ts` reproduced the known env-sensitive failure (`resolveModel > openai/* models > uses model router when no OpenAI auth is configured`, expected `model-router`, got `openai-direct` because OpenAI auth is present). Rerun excluding that known failure passed: `pnpm --filter ./mastracode exec vitest run src/tui/commands/__tests__/custom-providers.test.ts src/onboarding/__tests__/settings.test.ts src/tui/__tests__/command-dispatch.test.ts src/agents/__tests__/workspace-env.test.ts src/tui/components/__tests__/tool-execution-enhanced.test.ts --reporter=dot --bail 1` (5 files / 112 tests).
- Focused core tests passed: `pnpm --filter ./packages/core exec vitest run src/harness/workspace-resolution.test.ts src/harness/subagent-workspace-integration.test.ts src/workspace/tools/__tests__/read-file.test.ts src/workspace/tools/__tests__/list-files.test.ts src/workspace/tools/__tests__/execute-command.test.ts src/workspace/tools/__tests__/edit-file.test.ts src/workspace/tools/__tests__/lsp-inspect.test.ts --reporter=dot --bail 1` (7 files / 117 tests).

Next queue checkpoint: PR #13690 (Harness resource ID methods and `/resource`), then PR #13613 (HTTP MCP servers).


### Feature map PR #13690 and #13613

Processed PR [#13690](https://github.com/mastra-ai/mastra/pull/13690), `f77cd94c44` (`fix: implement Harness resource ID methods and improve /resource command`). Verified current source exposes Harness `getResourceId()`, `setResourceId()`, `getDefaultResourceId()`, and `getKnownResourceIds()`; `/resource` displays current/default/known IDs, switches resource scope, resumes the latest thread for that resource, or marks `pendingNewThread` when none exist. Headless mode supports `--resource-id` for non-TUI scoping.

Processed PR [#13613](https://github.com/mastra-ai/mastra/pull/13613), `bf7ee23532` (`feat(mastracode): support HTTP MCP servers in config`). Verified current MCP config accepts stdio `command` entries and HTTP `url` entries, static `headers`, and validated OAuth metadata. Manager builds `MCPClient` server defs with `URL`, `requestInit`, optional `MCPOAuthClientProvider`, transport-aware statuses, skipped-server reasons, reload/reconnect, namespaced tools, and app-data OAuth token storage.

Documentation actions:

- Added `features/threads/resource-id-switching.md` for `/resource`, headless `--resource-id`, Harness resource helpers, latest-thread resume, pending-new-thread path, and missing loaded-history/resource-switch tests.
- Added `features/integrations/mcp-server-configuration.md` for stdio/HTTP MCP config, merge precedence, OAuth/static headers, manager state ownership, and missing real HTTP/OAuth integration tests.
- Updated `features/README.md`, `_pr-queue.md`, `threads/persistent-conversations.md`, `integrations/mcp-status-command.md`, `tools/coding-tools-permissions.md`, `tui/help-and-shortcuts.md`, `handoff.md`, and this history entry. Queue status: #13690 done, #13613 done, #13691 current.

Verification:

- Current source checked: `mastracode/src/tui/commands/resource.ts`, `mastracode/src/tui/commands/__tests__/resource.test.ts`, `packages/core/src/harness/harness.ts`, `packages/core/src/harness/resource-id.test.ts`, `mastracode/src/headless.ts`, `mastracode/src/mcp/config.ts`, `mastracode/src/mcp/types.ts`, `mastracode/src/mcp/manager.ts`, `mastracode/src/mcp/__tests__/config.test.ts`, `mastracode/src/mcp/__tests__/manager.test.ts`, `mastracode/src/tui/commands/mcp.ts`, and `mastracode/src/main.ts`.
- PR metadata checked with `gh pr view 13690 --json number,title,body,author,mergedAt,url,files,commits` and `gh pr view 13613 --json number,title,body,author,mergedAt,url,files,commits`.
- Focused MC tests passed: `pnpm --filter ./mastracode exec vitest run src/tui/commands/__tests__/resource.test.ts src/mcp/__tests__/config.test.ts src/mcp/__tests__/manager.test.ts src/tui/__tests__/command-dispatch.test.ts src/headless.test.ts --reporter=dot --bail 1` (5 files / 138 tests).
- Focused core tests passed: `pnpm --filter ./packages/core exec vitest run src/harness/resource-id.test.ts --reporter=dot --bail 1` (1 file / 6 tests).

Next queue checkpoint: PR #13691 (debug.log env/size), then PR #13687 (workspace tool name remapping).


### Feature map batch: debug logging and workspace tool remapping

Processed PR [#13691](https://github.com/mastra-ai/mastra/pull/13691), `978a63d71e` (`fix(mastracode): gate debug.log behind MASTRA_DEBUG env var and cap file size`):

- Verified `mastracode/src/utils/debug-log.ts`: `setupDebugLogging()` only writes `getAppDataDir()/debug.log` when `MASTRA_DEBUG` is `true` or `1`; otherwise `console.error`/`console.warn` become no-ops to avoid corrupting the TUI.
- Verified `truncateLogFile()` caps existing logs over 5 MB by retaining roughly the last 4 MB and trimming to a newline boundary.
- Verified tests in `mastracode/src/utils/__tests__/debug-log.test.ts` cover default/false suppression, true/1 file logging, stack trace formatting, missing files, and size truncation.
- Created `.plan/mastracode-testing-recovery/features/tui/debug-logging.md` and cross-linked launch/TUI cards.

Processed PR [#13687](https://github.com/mastra-ai/mastra/pull/13687), `85664e9fd8` (`feat(workspace): support tool name remapping in workspace tools config`):

- Verified `WorkspaceToolConfig.name` in `packages/core/src/workspace/tools/types.ts` and `createWorkspaceTools()` in `tools.ts`: remapped tools register under the custom exposed dictionary key, update `tool.id`, and throw on duplicate exposed names.
- Verified `packages/core/src/workspace/tools/__tests__/tool-creation.test.ts` coverage for remapped filesystem/sandbox tools, preserved config options, ID updates, default-name preservation, and duplicate-name errors.
- Verified Mastra Code `TOOL_NAME_OVERRIDES` / `MC_TOOLS` usage across permissions, prompt guidance, subagent allowlists, validation errors, and `ToolExecutionComponentEnhanced` special cases.
- Updated workspace tools, coding tool permissions, README index, queue, and handoff. Queue now points at row 85 (#13569) as current.


### Feature map batch: OM clone on fork and test contamination cleanup

Processed PR [#13569](https://github.com/mastra-ai/mastra/pull/13569), `b8963791c6` (`feat(memory): clone Observational Memory when forking threads`). Verified current `Memory.cloneThread()` clones thread-scoped OM after the storage-domain thread/message clone, remaps `observedMessageIds`, deprecated `bufferedMessageIds`, and `bufferedObservationChunks[*].messageIds` through `messageIdMap`, resets transient observing/buffering flags, and rolls back the already-persisted clone if OM cloning fails before vector embedding. Resource-scoped OM is shared when the resource ID is unchanged and cloned with xxhash thread-tag remapping when the clone targets a new resource.

Processed PR [#13692](https://github.com/mastra-ai/mastra/pull/13692), `87ab58f1c5` (`fix(mastracode): fix test failures from cross-test contamination and add temp dir gitignore`). Verified current affected tests use `vi.hoisted(() => vi.resetModules())` to avoid isolate:false module-cache contamination in `model.test.ts` and command dispatch tests, and `.gitignore` covers `.test-tmp/` for interrupted local test output.

Documentation actions:

- Updated `features/memory/observational-memory.md` with OM clone/fork behavior, source-of-truth ownership, key clone files, `clone-thread-om.test.ts`, and storage-backed integration gaps.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13569 done, #13692 done, #13701 current.

Verification:

- Current source checked: `packages/memory/src/index.ts`, `packages/memory/src/clone-thread-om.test.ts`, `packages/core/src/storage/domains/memory/inmemory.ts`, `mastracode/src/agents/__tests__/model.test.ts`, `.gitignore`, and related feature-map pages.
- Focused memory test passed: `pnpm --filter ./packages/memory exec vitest run src/clone-thread-om.test.ts --reporter=dot --bail 1` (1 file / 11 tests).
- Focused MC tests passed with provider env vars unset: `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY pnpm --filter ./mastracode exec vitest run src/agents/__tests__/model.test.ts src/tui/__tests__/command-dispatch.test.ts --reporter=dot --bail 1` (2 files / 56 tests). The first run without env isolation hit the known local `OPENAI_API_KEY` routing mismatch in `model.test.ts`.

Next queue checkpoint: PR #13701 (separate TUI debug env var), then PR #13693 (set workspace).


### Feature map batch: TUI debug env split and custom workspace config

Processed PR [#13701](https://github.com/mastra-ai/mastra/pull/13701), `33f289c616` (`use separate tui debug env var`). Verified `mastracode/src/tui/components/assistant-message.ts` now gates assistant-message component trace output behind `MASTRA_TUI_DEBUG` while global console warning/error capture remains controlled by `MASTRA_DEBUG` in `utils/debug-log.ts`.

Processed PR [#13693](https://github.com/mastra-ai/mastra/pull/13693), `6e1b940177` (`feat(mc): set workspace`). Verified `MastraCodeConfig.workspace` and current `createMastraCode()` choose `config?.workspace ?? getDynamicWorkspace`, then pass that same workspace into both `HarnessV1` and `HarnessCompat`. Default dynamic workspace behavior remains unchanged when no override is provided.

Documentation actions:

- Updated `features/tui/debug-logging.md` with `MASTRA_TUI_DEBUG`, `tui-debug.log`, and the separation from app-data `debug.log`.
- Updated `features/tools/workspace-tools.md` with the public `createMastraCode({ workspace })` override, fallback behavior, state ownership, and missing config-level tests.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13701 done, #13693 done, #13700 current.

Verification:

- Current source checked: `mastracode/src/tui/components/assistant-message.ts`, `mastracode/src/utils/debug-log.ts`, `mastracode/src/index.ts`, `mastracode/src/agents/workspace.ts`, `packages/core/src/harness/workspace-resolution.test.ts`, and related feature-map pages.
- Focused MC tests passed: `pnpm --filter ./mastracode exec vitest run src/utils/__tests__/debug-log.test.ts src/index.test.ts src/agents/__tests__/workspace-env.test.ts src/agents/__tests__/build-skill-paths.test.ts src/agents/__tests__/workspace-skill-activation.test.ts --reporter=dot --bail 1` (5 files / 20 tests).
- Focused core test passed: `pnpm --filter ./packages/core exec vitest run src/harness/workspace-resolution.test.ts --reporter=dot --bail 1` (1 file / 12 tests, no type errors).

Next queue checkpoint: PR #13700 (forward requestContext and skill paths to subagents), then PR #13710 (README follow-ups).


### Feature map batch: subagent request context and template README follow-ups

Processed PR [#13700](https://github.com/mastra-ai/mastra/pull/13700), `1c4221cf60` (`fix: forward requestContext and skill paths to subagents`). Verified current core `createSubagentTool()` forwards a copied `RequestContext` into `subagentToRun.stream()`. Non-forked subagents preserve harness state but strip parent `threadId`/`resourceId`; forked subagents retarget inherited tools to the cloned thread/resource. Verified Mastra Code `getAllowedPathsFromContext()` now merges computed skill paths from `buildSkillPaths(projectPath, configDir)` with `sandboxAllowedPaths`, so delegated agents can access the same skill directories and user-approved external paths as the parent.

Processed PR [#13710](https://github.com/mastra-ai/mastra/pull/13710), `bc2665ebf3` (`chore(templates): README follow-ups`). Verified this is template README copy cleanup only; no Mastra Code runtime feature card was needed.

Documentation actions:

- Updated `features/subagents/delegation.md` with request-context copy/retarget behavior, inherited filesystem access, test coverage, and leakage risk.
- Updated `features/tools/workspace-tools.md` with subagent skill/sandbox path inheritance and `getAllowedPathsFromContext()` coverage.
- Updated `features/integrations/skills-command.md` with skill-path inheritance for delegated agents.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13700 done, #13710 done, #13713 current.

Verification:

- Current source checked: `packages/core/src/harness/tools.ts`, `packages/core/src/harness/subagent-tool.test.ts`, `mastracode/src/agents/workspace.ts`, `mastracode/src/tools/utils.ts`, `mastracode/src/tools/__tests__/get-allowed-paths.test.ts`, and related feature-map pages.
- Focused core tests passed: `pnpm --filter ./packages/core exec vitest run src/harness/subagent-tool.test.ts src/harness/subagent-workspace-integration.test.ts --reporter=dot --bail 1` (2 files / 29 tests, no type errors).
- Focused MC tests passed: `pnpm --filter ./mastracode exec vitest run src/tools/__tests__/get-allowed-paths.test.ts src/agents/__tests__/build-skill-paths.test.ts src/agents/__tests__/workspace-skill-activation.test.ts --reporter=dot --bail 1` (3 files / 17 tests).

Next queue checkpoint: PR #13713 (dynamic extraTools functions), then PR #13712 (Ctrl+V clipboard paste).


### Feature map batch: dynamic extraTools functions and clipboard paste

Processed PR [#13713](https://github.com/mastra-ai/mastra/pull/13713), `d7ed2bb64e` (`feat(mastracode): support dynamic extraTools functions`). Verified current `createDynamicTools()` accepts either a static extra-tools record or a function that receives `{ requestContext }`, resolves the tools per request, then applies the existing no-overwrite guard plus disabled/denied filtering.

Processed PR [#13712](https://github.com/mastra-ai/mastra/pull/13712), `d365d2926b` (`feat(cli): Add clipboard image and text paste support via Ctrl+V`). Verified `CustomEditor` maps Ctrl+V / Alt+V to explicit clipboard paste: image clipboard data calls `onImagePaste` when present; text clipboard data is wrapped in bracketed-paste markers and sent through the existing paste pipeline. Also verified bracketed paste still handles empty image pastes, local image paths/file URLs, and remote image URLs. Current source did not show a production `onImagePaste` assignment, so the feature map records that as an integration gap.

Documentation actions:

- Created `features/tui/clipboard-paste.md` for editor clipboard text/image paste behavior and platform helper risks.
- Updated `features/tools/coding-tools-permissions.md` with request-context-aware extraTools function behavior.
- Updated `features/tui/interactive-chat.md`, `features/tui/help-and-shortcuts.md`, and `features/chat/file-attachments.md` with Ctrl+V/Alt+V and attachment-pipeline links.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13713 done, #13712 done, #13716 current.

Verification:

- Current source checked: `mastracode/src/agents/tools.ts`, `mastracode/src/agents/extra-tools.test.ts`, `mastracode/src/clipboard/index.ts`, `mastracode/src/clipboard/__tests__/index.test.ts`, `mastracode/src/tui/components/custom-editor.ts`, `mastracode/src/tui/components/__tests__/custom-editor.test.ts`, and related feature-map pages.
- Focused MC tests passed: `pnpm --filter ./mastracode exec vitest run src/agents/extra-tools.test.ts src/clipboard/__tests__/index.test.ts src/tui/components/__tests__/custom-editor.test.ts --reporter=dot --bail 1` (3 files / 38 tests).

Next queue checkpoint: PR #13716 (export `resolveModel`), then PR #13603 (auto-update prompt on session start).

### Feature map batch: resolveModel export and auto-update prompts

Processed PR [#13716](https://github.com/mastra-ai/mastra/pull/13716), `ee8de2adcf` (`feat(mastracode): export resolveModel from createMastraCode`). Verified current `createMastraCode()` returns `resolveModel` alongside Harness/TUI dependencies so external consumers can resolve model IDs through the same configured provider registry, custom-provider routing, gateway/OAuth/API-key fallback, and request-context-aware resolver path used by Mastra Code itself.

Processed PR [#13603](https://github.com/mastra-ai/mastra/pull/13603), `548da794ec` (`feat(mastracode): auto-update prompt on session start`). Verified current startup update checks use `utils/update-check.ts` for current/latest version detection, package-manager-specific install commands, semver comparison, changelog fetch/parse, and update execution. `MastraTUI` triggers an initial non-passive check after startup work and schedules passive rechecks every 45 minutes; declining persists `settings.updateDismissedVersion` so the same version is not repeatedly prompted.

Documentation actions:

- Created `features/setup/auto-update-prompts.md` for startup update checks, dismissed-version persistence, package-manager install command selection, and test gaps.
- Updated `features/setup/installation-and-launch.md` with the startup update prompt link.
- Updated `features/models/model-auth-and-modes.md` and `features/integrations/harness-api.md` with the exported `resolveModel` surface.
- Updated `features/settings/onboarding-and-global-settings.md` with `updateDismissedVersion` ownership.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13716 done, #13603 done, #13696 current.

Verification:

- Current source checked: `mastracode/src/index.ts`, `mastracode/src/agents/model.ts`, `mastracode/src/utils/update-check.ts`, `mastracode/src/tui/mastra-tui.ts`, `mastracode/src/tui/commands/update.ts`, `mastracode/src/onboarding/settings.ts`, and related feature-map pages.
- Focused tests passed: `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u GOOGLE_GENERATIVE_AI_API_KEY -u DEEPSEEK_API_KEY pnpm --filter ./mastracode exec vitest run src/utils/__tests__/update-check.test.ts src/tui/commands/__tests__/update.test.ts src/index.test.ts src/agents/__tests__/model.test.ts --reporter=dot --bail 1` (3 files / 50 tests). First run without env isolation hit the known local `OPENAI_API_KEY` routing mismatch in `model.test.ts`.

Next queue checkpoint: PR #13696 (queue parallel interactive tool calls), then PR #13724 (workspace gitignore support, lower tree depth, and tool guidance).

### Feature map batch: queued interactive prompts and gitignore-aware workspace tools

Processed PR [#13696](https://github.com/mastra-ai/mastra/pull/13696), `6f2946f240` (`fix(mastracode): queue parallel interactive tool calls to prevent input corruption`). Verified current TUI prompt handling serializes concurrent inline `ask_user` and sandbox access prompts through `TUIState.pendingInlineQuestions`. The first prompt stays active in `activeInlineQuestion`; later activations wait until submit/cancel calls `processNextInlineQuestion()`. Ctrl+C/Escape and process SIGINT cleanup clear both `activeInlineQuestion` and `pendingInlineQuestions` before aborting Harness so queued prompts do not appear after abort.

Processed PR [#13724](https://github.com/mastra-ai/mastra/pull/13724), `77b4a254e5` (`feat(workspace): gitignore support, lower tree depth, fix tool guidance`). Verified current core Workspace tools load workspace-root `.gitignore` via `loadGitignore()`. `find_files` defaults `maxDepth` to 2 and `respectGitignore` to true; `search_content` skips gitignored paths during recursive walks, while still allowing explicitly targeted ignored directories. Tool guidance now tells agents that `find_files` and `search_content` respect `.gitignore` by default.

Documentation actions:

- Created `features/tui/interactive-prompts.md` for queued inline question/access-request behavior and abort cleanup.
- Updated `features/tui/interactive-chat.md` with #13696 queue ownership and links.
- Updated `features/tools/workspace-tools.md` with `.gitignore` filtering, default depth, explicit ignored-target bypass, and tests.
- Updated `features/tools/coding-tools-permissions.md` with prompt queueing and gitignore-aware guidance.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13696 done, #13724 done, #13723 current.

Verification:

- Current source checked: `mastracode/src/tui/handlers/prompts.ts`, `mastracode/src/tui/state.ts`, `mastracode/src/tui/setup.ts`, `mastracode/src/tui/__tests__/parallel-interactive-prompts.test.ts`, `packages/core/src/workspace/gitignore.ts`, `packages/core/src/workspace/tools/list-files.ts`, `grep.ts`, `tree-formatter.ts`, related workspace tool tests, and `mastracode/src/agents/prompts/tool-guidance.ts`.
- Focused tests passed: MC prompt/extra-tools tests (2 files / 27 tests) and core workspace list/search/tree tests (3 files / 99 tests, no type errors).

Next queue checkpoint: PR #13723 (Ctrl+Z suspend), then PR #13523 (likely version-package skip).

### Feature map batch: process suspend shortcut and version-package skip

Processed PR [#13723](https://github.com/mastra-ai/mastra/pull/13723), `52022c842c` (`feat(mastracode): Ctrl+Z now suspends the process (SIGTSTP)`). Verified current TUI editor routing maps Ctrl+Z to a `suspend` action and Alt+Z to the prior undo-last-clear action. `setupKeyboardShortcuts()` stops the UI, registers a one-shot `SIGCONT` handler, sends `SIGTSTP` to the current process, and restarts/render-refreshes the UI on continuation. Windows is guarded with an info message, and signal failure removes the listener, restarts UI, requests render, and shows an error. Alt+Z restores `TUIState.lastClearedText` only when the editor is empty.

Reviewed PR [#13523](https://github.com/mastra-ai/mastra/pull/13523), `edfda994ef` (`chore: version packages (alpha)`). This is a version-package batch. Relevant MastraCode/core touched files are only `CHANGELOG.md` and `package.json` updates, so it is recorded as a skip and no behavior feature page was created.

Documentation actions:

- Created `features/tui/process-suspend.md` for Ctrl+Z suspend / Alt+Z undo behavior, state ownership, risks, and test gaps.
- Updated `features/tui/help-and-shortcuts.md` with Ctrl+Z/Alt+Z shortcut semantics.
- Updated `features/tui/interactive-chat.md` with process suspend as part of editor/setup lifecycle.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13723 done, #13523 skipped, #13760 current.

Verification:

- Current source checked: `mastracode/src/tui/components/custom-editor.ts`, `mastracode/src/tui/setup.ts`, `mastracode/src/tui/state.ts`, `mastracode/src/tui/components/help-overlay.ts`, `mastracode/src/tui/components/settings.ts`, `mastracode/src/tui/components/__tests__/custom-editor.test.ts`, `mastracode/src/tui/__tests__/setup-keyboard-shortcuts.test.ts`, and PR #13523 changed-file list.
- Focused tests passed for direct editor/help coverage: `custom-editor.test.ts` and `help-overlay.test.ts` (2 files / 22 tests). Broader shortcut setup run also included `setup-keyboard-shortcuts.test.ts` but hit the known stale /github autocomplete drift: expected `subscribe, unsubscribe, debug`, received `subscribe, unsubscribe, sync, debug`.

Next queue checkpoint: PR #13760 (inline version at build time), then PR #13761 (likely version-package skip).

### Feature map batch: build-time version injection and release skip

Processed PR [#13760](https://github.com/mastra-ai/mastra/pull/13760), `fa9692afe2` (`fix(mastracode): inline version at build time instead of requiring package.json`). Verified current `getCurrentVersion()` prefers a build-time `MASTRACODE_VERSION` define injected by `mastracode/tsup.config.ts`, preventing published npm installs from requiring `../../package.json` at runtime. Current source also contains the later source-run fallback, which will be verified again at queue rows #13767/#13768.

Reviewed PR [#13761](https://github.com/mastra-ai/mastra/pull/13761), `3e2b181a61` (`chore: version packages (alpha)`). This is the alpha release follow-up for #13760. Changed files are `.changeset/pre.json`, `mastracode/CHANGELOG.md`, and `mastracode/package.json`; no separate behavior feature page was needed.

Documentation actions:

- Updated `features/setup/auto-update-prompts.md` with build-time current-version ownership, npm-packaged startup risk, and missing coverage for packaged builds.
- Updated `features/setup/installation-and-launch.md` with `MASTRACODE_VERSION` build injection.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13760 done, #13761 skipped, #13767 current.

Verification:

- Current source checked: `mastracode/src/utils/update-check.ts`, `mastracode/tsup.config.ts`, `mastracode/src/main.ts` earlier in the update-prompt batch, `features/setup/auto-update-prompts.md`, `features/setup/installation-and-launch.md`, and PR #13761 changed-file list.
- Focused tests passed: `corepack pnpm.3.0 --filter ./mastracode exec vitest run src/utils/__tests__/update-check.test.ts --reporter=dot --bail 1` (1 file / 13 tests). Initial `pnpm` run failed because local pnpm 10.29.3 no longer satisfies root `packageManager`/engine metadata requiring pnpm 11.3.0.

Next queue checkpoint: PR #13767 (source fallback for version detection), then PR #13768 (ESM-compatible version fallback).

### Feature map batch: source-safe version detection fallbacks

Processed PR [#13767](https://github.com/mastra-ai/mastra/pull/13767), `205bbac168` (`fix(mastracode): fallback to package.json when running from source`). Verified current `getCurrentVersion()` guards `typeof MASTRACODE_VERSION !== 'undefined'` before using the build-time define. When running directly from source where tsup has not injected the constant, current source falls back to package metadata.

Processed PR [#13768](https://github.com/mastra-ai/mastra/pull/13768), `46211b2799` (`fix(mastracode): use ESM-compatible fallback for version detection`). Verified current fallback uses ESM-safe `dirname(fileURLToPath(import.meta.url))`, `resolve()`, and `readFileSync()` rather than CommonJS `require`, avoiding `require is not defined` in the ESM package.

Documentation actions:

- Updated `features/setup/auto-update-prompts.md` with source-run fallback behavior, ESM compatibility, and missing version-detection tests.
- Updated `features/setup/installation-and-launch.md` with package-version detection ownership across built and source-run paths.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13767 done, #13768 done, #13748 current.

Verification:

- Current source checked: `mastracode/src/utils/update-check.ts`, PR metadata for #13767/#13768, and related setup/update feature cards.
- Focused tests passed: `corepack pnpm.3.0 --filter ./mastracode exec vitest run src/utils/__tests__/update-check.test.ts --reporter=dot --bail 1` (1 file / 13 tests).

Next queue checkpoint: PR #13748 (persist thinking level as a global preference), then PR #13787 (`/update` slash command).

### Feature map batch: persistent thinking preference and manual update command

Processed PR [#13748](https://github.com/mastra-ai/mastra/pull/13748), `a3c16eb1be` (`fix: persist thinking level as a global preference`). Verified current `/think` direct args and selector update both Harness state and `settings.preferences.thinkingLevel` through `persistGlobalThinkingLevel()`. Settings UI also writes thinking-level changes to settings, and OpenAI-heavy model-pack activation persists the automatic `off` → `low` bump alongside the Harness state change.

Processed PR [#13787](https://github.com/mastra-ai/mastra/pull/13787), `02cbb66435` (`feat(mastracode): add /update slash command`). Verified current `/update` command fetches latest npm version, compares with current runtime version, clears prior dismissed-version state before prompting, displays optional changelog text, runs the detected package-manager install on Yes, persists `updateDismissedVersion` on No, and is registered in slash dispatch/setup/help surfaces.

Documentation actions:

- Updated `features/models/thinking-and-reasoning.md` with #13748 persistence behavior across `/think`, `/settings`, and OpenAI pack auto-bumps.
- Updated `features/setup/auto-update-prompts.md` with #13787 manual `/update` command behavior, state ownership, and missing command coverage.
- Updated `features/settings/onboarding-and-global-settings.md`, `features/tui/help-and-shortcuts.md`, `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13748 done, #13787 done, #13753 current.

Verification:

- Current source checked: `mastracode/src/tui/commands/think.ts`, `mastracode/src/tui/commands/settings.ts`, `mastracode/src/tui/commands/models-pack.ts`, `mastracode/src/onboarding/settings.ts`, `mastracode/src/index.ts`, `mastracode/src/tui/commands/update.ts`, `mastracode/src/tui/command-dispatch.ts`, `mastracode/src/tui/components/help-overlay.ts`, `mastracode/src/tui/setup.ts`, `mastracode/src/utils/update-check.ts`, settings tests, models-pack tests, and update-check tests.
- Focused tests passed: `corepack pnpm@11.3.0 --filter ./mastracode exec vitest run src/utils/__tests__/update-check.test.ts src/onboarding/__tests__/settings.test.ts src/tui/commands/__tests__/models-pack.test.ts src/tui/__tests__/command-dispatch.test.ts --reporter=dot --bail 1`.

Next queue checkpoint: PR #13753 (request access rename, tilde expansion, mid-turn allowed paths), then PR #13611 (auth routing fix, tool injection, and auth storage init).

### Feature map batch: request access and auth routing

Processed PR [#13753](https://github.com/mastra-ai/mastra/pull/13753), `633370bdf4` (`fix: rename request_sandbox_access to request_access, fix tilde expansion and mid-turn setAllowedPaths`). Verified current `request_access` expands `~`, resolves relative paths to absolute paths, short-circuits already-allowed paths, emits a queued `sandbox_access_request` question through the Harness TUI context, persists approved paths to `sandboxAllowedPaths`, and updates the active `LocalFilesystem` with `setAllowedPaths()` so same-turn follow-up file tools can access the path.

Processed PR [#13611](https://github.com/mastra-ai/mastra/pull/13611), `f6b91c454b` (`feat(mastracode): auth routing fix, tool injection, and auth storage init`). Verified current `createAuthStorage()` initializes shared auth storage for Anthropic, OpenAI Codex, and GitHub Copilot providers; `createMastraCode()` loads stored provider API keys into env before access/model checks; `resolveModel()` routes explicit `mastra/<provider>/<model>` IDs through Memory Gateway while keeping plain provider IDs on their normal paths; Anthropic/OpenAI OAuth gateway paths use direct provider construction with gateway auth headers and OAuth fetch wrappers; custom providers still bypass gateway first.

Documentation actions:

- Updated `features/tui/interactive-prompts.md` with `request_access` rename, tilde expansion, same-turn filesystem updates, and access-request tests.
- Updated `features/tools/workspace-tools.md` and `features/tools/coding-tools-permissions.md` with same-turn allowed-path ownership and dynamic tool injection notes.
- Updated `features/models/model-auth-and-modes.md`, `features/models/custom-providers.md`, and `features/settings/onboarding-and-global-settings.md` with #13611 auth routing/auth-storage behavior.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13753 done, #13611 done, #13815 current.

Verification:

- Current source checked: `mastracode/src/tools/request-sandbox-access.ts`, `mastracode/src/tools/__tests__/request-sandbox-access.test.ts`, `mastracode/src/tui/handlers/prompts.ts`, `mastracode/src/tui/__tests__/parallel-interactive-prompts.test.ts`, `mastracode/src/agents/model.ts`, `mastracode/src/providers/claude-max.ts`, `mastracode/src/providers/openai-codex.ts`, `mastracode/src/permissions.ts`, `mastracode/src/index.ts`, `mastracode/src/agents/__tests__/model.test.ts`, `mastracode/src/agents/extra-tools.test.ts`, and `mastracode/src/__tests__/index.test.ts`.
- Focused tests passed after clearing local provider env vars: `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u MASTRA_GATEWAY_API_KEY corepack pnpm@11.3.0 --filter ./mastracode exec vitest run src/tools/__tests__/request-sandbox-access.test.ts src/tui/__tests__/parallel-interactive-prompts.test.ts src/agents/__tests__/model.test.ts src/agents/extra-tools.test.ts src/__tests__/index.test.ts --reporter=dot --bail 1` (5 files / 84 tests). Initial unguarded run failed because local `OPENAI_API_KEY` changed expected OpenAI routing in `model.test.ts`.

Next queue checkpoint: PR #13815 (`omScope` config), then PR #13766 (version-package skip).

### Feature map batch: OM scope override and release skip

Processed PR [#13815](https://github.com/mastra-ai/mastra/pull/13815), `324fff2672` (`feat(mastracode): add omScope to MastraCodeConfig`). Verified current `MastraCodeConfig.omScope` accepts `'thread' | 'resource'` and seeds `globalInitialState.omScope` before Harness startup. The dynamic memory factory uses `state.omScope ?? getOmScope(projectPath)`, where `getOmScope()` falls back through `MASTRA_OM_SCOPE`, project `.mastracode/database.json`, global `~/.mastracode/database.json`, then `'thread'`. Resource-scoped OM disables async buffering by setting observation `bufferTokens: false` and omitting observation/reflection `bufferActivation` values so core OM validation does not reject resource scope.

Reviewed PR [#13766](https://github.com/mastra-ai/mastra/pull/13766), `38a334998f` (`chore: version packages (alpha)`). It is a release-version package/changelog sweep with no separate Mastra Code behavior to map.

Documentation actions:

- Updated `features/memory/observational-memory.md` with configurable OM scope, resource-scope async-buffer disabling, source files, missing tests, and risk notes.
- Updated `features/settings/storage-backend.md` because `database.json` also owns `omScope` precedence alongside storage/resource settings.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13815 done, #13766 skipped, #13870 current.

Verification:

- Current source checked: `mastracode/src/agents/memory.ts`, `mastracode/src/index.ts`, `mastracode/src/schema.ts`, `mastracode/src/utils/project.ts`, current OM/storage feature cards, and PR #13766 changed-file list.
- Focused tests passed: `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u MASTRA_GATEWAY_API_KEY corepack pnpm@11.3.0 --filter ./mastracode exec vitest run src/tui/commands/__tests__/om.test.ts src/tui/components/__tests__/om-settings.test.ts src/tui/handlers/__tests__/om.test.ts src/__tests__/index.test.ts --reporter=dot --bail 1` (4 files / 27 tests). Direct `omScope` precedence/config tests are still missing and recorded as a gap.

Next queue checkpoint: PR #13870 (enhanced web_search rendering), then PR #12532 (build tools dependency update).

### Feature map batch: web-search rendering and build-tool deps

Processed PR [#13870](https://github.com/mastra-ai/mastra/pull/13870), `57764e02c0` (`feat(mastracode): enhanced web_search tool rendering`). Verified current TUI renderer behavior in `ToolExecutionComponentEnhanced`: `isWebSearchTool()` recognizes `web_search` and `web_search_YYYYMMDD`; normal mode renders a bordered block with `web_search "query"` in the footer; Anthropic/provider JSON arrays render title, URL, and optional `pageAge`; OpenAI `{ action, sources }` objects render source titles/URLs; Tavily markdown output passes through unchanged. Fallback JSON-array rendering strips `encryptedContent` before dumping unknown array shapes.

Reviewed PR [#12532](https://github.com/mastra-ai/mastra/pull/12532), `7abbf1fb29` (`chore(deps): update build tools`). The Mastra Code-specific diff only bumped dev/build dependencies in `mastracode/package.json` (`@types/node`, `tsx`) plus lockfile/build-tool dependency updates across the monorepo, so it is recorded as dependency-only rather than a user-visible feature.

Documentation actions:

- Created `features/tools/web-search-rendering.md` for TUI web-search result formatting and parser/preview risks.
- Updated `features/tools/coding-tools-permissions.md` and `features/tui/quiet-mode.md` with #13870 later-change refs.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13870 done, #12532 skipped, #13648 current.

Verification:

- Current source checked: `mastracode/src/tui/components/tool-execution-enhanced.ts`, `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts`, `mastracode/src/tools/web-search.ts`, current tool/quiet feature cards, and PR #12532 Mastra Code package diff.
- Focused tests passed: `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u MASTRA_GATEWAY_API_KEY corepack pnpm@11.3.0 --filter ./mastracode exec vitest run src/tui/components/__tests__/tool-execution-enhanced.test.ts --reporter=dot --bail 1` (1 file / 61 tests). Normal-mode provider-specific web-search rendering still needs dedicated tests and is recorded as a gap.

Next queue checkpoint: PR #13648 (headless non-interactive `--prompt` mode), then PR #13695 (OpenAI strict mode fix).

### Feature map batch: headless prompt mode and OpenAI strict schema compatibility

Processed PR [#13648](https://github.com/mastra-ai/mastra/pull/13648), `4df211619d` (`feat(mastracode): add headless non-interactive mode via --prompt flag`). Verified current `headless.ts` parses `--prompt`/`-p`, stdin prompts, timeout, JSON/text/stream-json output modes, model/mode/thinking flags, thread/resource controls, and settings override. `main.ts` dispatches to `headlessMain()` when a headless flag is present. Runtime subscribes to Harness events, streams assistant text to stdout, writes tools/subagents/shell/status to stderr, auto-approves tool/plan/access prompts, auto-answers `ask_user`, aborts on timeout with exit 2, and cleans up thread locks/MCP/workers/heartbeats/signals pubsub.

Processed PR [#13695](https://github.com/mastra-ai/mastra/pull/13695), `aae2295838` (`fix(schema-compat, core): fix OpenAI strict mode schema rejection for agent networks (#12284)`). Verified current core agent structured-output path applies OpenAI null-transform compatibility when provider identifies OpenAI even if `modelId` is undefined/empty. `prepareJsonSchemaForOpenAIStrictMode()` now ensures every object property is required and all object schemas get `additionalProperties: false` before OpenAI strict JSON requests. OpenAI and OpenAI-reasoning schema compat layers use null-safe `modelId` checks and preserve optional/default/nullish Zod semantics through nullable transforms.

Documentation actions:

- Created `features/headless/prompt-mode.md` for non-interactive CLI behavior, output contracts, auto-resolution, state ownership, and risks.
- Created `features/models/openai-strict-schema-compat.md` for OpenAI strict-mode schema preparation, agent-network modelId fallback, and workspace/tool schema risks.
- Updated `features/setup/installation-and-launch.md`, `features/models/model-auth-and-modes.md`, `features/tools/workspace-tools.md`, `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13648 done, #13695 done, #13999 current.

Verification:

- Current source checked: `mastracode/src/headless.ts`, `mastracode/src/main.ts`, `mastracode/src/headless.test.ts`, `mastracode/src/headless-integration.test.ts`, `packages/core/src/agent/agent.ts`, `packages/core/src/agent/__tests__/structured-output-openai-compat.test.ts`, `packages/core/src/stream/aisdk/v5/execute.ts`, `packages/schema-compat/src/zod-to-json.ts`, `packages/schema-compat/src/provider-compats/openai.ts`, and `packages/schema-compat/src/provider-compats/openai-reasoning.ts`.
- Focused tests passed: `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u MASTRA_GATEWAY_API_KEY corepack pnpm@11.3.0 --filter ./mastracode exec vitest run src/headless.test.ts --reporter=dot --bail 1` (1 file / 44 tests); `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u MASTRA_GATEWAY_API_KEY corepack pnpm@11.3.0 --filter ./mastracode exec vitest run src/headless-integration.test.ts -t 'emits agent_start|emits tool_start|streams message_update|AgentsMDInjector|switches model|returns exit code 1|emits JSON error|emits warning|structured warning|does not switch|--mode|--model still|no effectiveDefaults|resumes|renames|thread_cloned' --reporter=dot --bail 1` (22 passed / 1 skipped); `corepack pnpm@11.3.0 --filter ./packages/core exec vitest run src/agent/__tests__/structured-output-openai-compat.test.ts --reporter=dot --bail 1` (1 file / 5 tests); `corepack pnpm@11.3.0 --filter ./packages/schema-compat exec vitest run src/zod-to-json.test.ts src/provider-compats/openai.test.ts src/provider-compats/openai-reasoning.test.ts --reporter=dot --bail 1` (4 files / 179 passed / 1 skipped). Full `headless.test.ts + headless-integration.test.ts` run timed out in the existing abort integration case and is recorded as a headless risk.

Next queue checkpoint: PR #13999 (shell passthrough real-time streaming), then PR #13940 (subagent workspace inheritance).


### PR #13999 / #13940 feature-map checkpoint

Verified rows 113-114:

- #13999 streams TUI shell passthrough (`!<command>`) output in real time. `handleShellPassthrough()` now creates a `ShellStreamComponent`, pipes subprocess stdout/stderr `data` events directly into it, and finalizes through `resolveShellPassthroughCompletion()` so spawn failures/timeouts produce diagnostics without duplicating already-streamed stderr. Created `features/tui/shell-passthrough.md`.
- #13940 makes non-forked subagents inherit the parent `Workspace` instead of carrying duplicate MC-local file/edit/shell tool definitions. `createSubagentTool()` passes `context.workspace` into fresh subagent Agents, and `allowedWorkspaceTools` filters inherited workspace tools through `prepareStep`; forked subagents still reuse the parent agent/thread clone path. Updated delegation and workspace-tool cards.

Focused evidence read: `mastracode/src/tui/shell.ts`, `shell-runner.ts`, `shell-result.ts`, `components/shell-output.ts`, `packages/core/src/harness/tools.ts`, `subagent-tool.test.ts`, `subagent-workspace-integration.test.ts`, and built-in subagent definitions.

### PR #13953 / #14062 feature-map checkpoint

Verified rows 115-116:

- #13953 adds attachment support to observational memory and wires Mastra Code pasted images into real chat submission. Current source forwards editor `onImagePaste` into `TUIState.pendingImages`, inserts `[image]` placeholders, consumes only referenced images on submit/queued follow-up, renders optimistic image messages, and sends image data through Harness signal/file content. OM now formats user/tool-result image/file parts as observer placeholders plus real attachment parts, supports `observeAttachments` (`auto`/on/off), filters by provider attachment capability/mime patterns, and counts images/files with provider-aware token estimates, provider count-token endpoints, remote image probing, client-stamped estimates, caching, and in-flight deduping.
- #14062 is formatting/lint dependency-only for this feature map pass and was skipped.

Documentation actions:

- Updated `features/memory/observational-memory.md` with #13953 attachment observation, token counting, settings/state ownership, source/test files, and risks.
- Updated `features/chat/file-attachments.md` with TUI pasted-image submission and OM attachment preservation.
- Updated `features/tui/clipboard-paste.md` to close the earlier integration gap: `onImagePaste` is now wired in `mastracode/src/tui/mastra-tui.ts`.
- Updated `features/settings/onboarding-and-global-settings.md`, `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13953 done, #14062 skipped, #13883 current.

Focused evidence read: `mastracode/src/tui/mastra-tui.ts`, `custom-editor.ts`, `mastra-tui-images.test.ts`, `mastra-tui-queueing.test.ts`, `mastracode/src/agents/memory.ts`, `thread-caveman-state.ts`, `index.test.ts`, `om.ts`, `packages/memory/src/processors/observational-memory/types.ts`, `observer-runner.ts`, `observer-agent.ts`, `message-utils.ts`, `token-counter.ts`, `observational-memory.test.ts`, and `token-counter.test.ts`.

Verification:

- `corepack pnpm@11.3.0 --filter ./mastracode exec vitest run src/tui/__tests__/mastra-tui-images.test.ts src/tui/__tests__/mastra-tui-queueing.test.ts --reporter=dot --bail 1` — 2 files / 33 tests passed.
- `corepack pnpm@11.3.0 --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/token-counter.test.ts src/processors/observational-memory/__tests__/observational-memory.test.ts --reporter=dot --bail 1` — 2 files / 496 passed / 1 todo.

### PR #13883 / #14102 / #14146 / #13750 feature-map checkpoint

Verified rows 117-120:

- #13883, #14102, and #14146 are Changesets alpha/version-package batches touching CHANGELOG/package metadata across many packages; skipped for user-visible Mastra Code feature mapping.
- #13750 adds programmatic MCP server configuration via `createMastraCode({ mcpServers })`. Current source exposes `MastraCodeConfig.mcpServers`, passes it to `createMcpManager(project.rootPath, configDir, config?.mcpServers)`, merges those programmatic servers over file-loaded MCP config, and reapplies the same overrides on manager reload. `disableMcp: true` still disables file and programmatic MCP.

Documentation actions:

- Updated `features/integrations/mcp-server-configuration.md` with programmatic config ownership, precedence, reload behavior, key files, tests, and risks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry. Queue status: #13883/#14102/#14146 skipped, #13750 done, #13996 current.

Focused evidence read: PR metadata for #13883/#14102/#14146/#13750; `mastracode/src/index.ts`, `mastracode/src/mcp/manager.ts`, `mastracode/src/mcp/types.ts`, and `mastracode/src/mcp/__tests__/manager.test.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/mcp/__tests__/manager.test.ts --bail=1 --reporter=dot` — 1 file / 44 tests passed.
- `pnpm --filter ./mastracode test -- --run src/mcp/__tests__/manager.test.ts --bail 1 --reporter=dot` unexpectedly expanded into the broader suite and hit known baseline failures (including stale `/github` autocomplete drift); focused direct Vitest run above passed.

### PR #13996 / #14157 / #14147 / #14168 feature-map checkpoint

Verified rows 121-124:

- #13996 restored typed filtering in the `/om` model picker for Kitty CSI-u terminal input. Original merge added a local decoder in `om-settings.ts`; current HEAD has evolved the picker around `ModelSelectorComponent` and shared key-input coverage (`key-input.ts` / `key-input.test.ts`).
- #14157 is a real schema-compatibility feature, not a skip: `toStandardSchema()` now detects Zod v4 schemas without `~standard.jsonSchema`, wraps them with `adapters/zod-v4.ts`, and uses `z.toJSONSchema()` so Harness/Mastra Code tool schemas serialize as valid JSON Schema objects. `mastracode` also ships `zod` as a CLI dependency.
- #14147 is a Changesets alpha/version-package batch; skipped for feature mapping.
- #14168 removes the generic TUI replacement for tool validation errors and keeps the actual parsed validation message visible in formatted error output. Current HEAD also has specialized tool validation rendering in `tool-execution-enhanced.ts`.

Documentation actions:

- Created `features/models/tool-schema-compatibility.md` for generic Standard Schema / Zod v4 schema conversion.
- Updated `features/models/openai-strict-schema-compat.md`, `features/memory/observational-memory.md`, `features/tools/coding-tools-permissions.md`, `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #13996 done, #14157 done, #14147 skipped, #14168 done, #14167 current.

Focused evidence read: PR metadata for #13996/#14157/#14147/#14168; original #13996 and #14168 merge diffs; current `mastracode/src/tui/components/om-settings.ts`, `model-selector.ts`, `key-input.ts`, `display.ts`, `utils/errors.ts`, `tool-execution-enhanced.ts`; current `packages/schema-compat/src/standard-schema/standard-schema.ts`, `adapters/zod-v4.ts`, and `adapters/zod-v4.test.ts`.

Verification:

- `corepack pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/key-input.test.ts src/tui/components/__tests__/om-settings.test.ts --bail=1 --reporter=dot` via combined command — 2 files / 64 tests passed.
- `corepack pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/tool-execution-enhanced.test.ts --bail=1 --reporter=dot` — 1 file / 61 tests passed.
- `corepack pnpm --filter ./packages/schema-compat exec vitest run src/standard-schema/adapters/zod-v4.test.ts src/zod-to-json.test.ts --bail=1 --reporter=dot` — 3 files / 107 passed / 1 skipped.
- Initial `pnpm` runs failed because the active shim was pnpm 10.29.3 while this repo requires pnpm >=11; `corepack prepare pnpm@11.3.0 --activate` fixed the local runner.

### PR #14167 / #13568 / #14264 feature-map checkpoint

Verified rows 125-127:

- #14167 is a Changesets alpha/version-package batch touching only changelogs/package manifests; skipped for feature mapping.
- #13568 adds observer context optimization for OM: `observation.previousObserverTokens` defaults to `2000`, `false` disables the optimization, and `0` omits previous observations. `prepareObserverContext()` swaps reflected raw observation lines for buffered reflection summaries, token-bounds previous observations, keeps a recent raw tail, preserves important 🔴/✅ older lines when budget allows, emits `[N observations truncated here]` markers, and passes explicit `wasTruncated` state plus prior `current-task` / `suggested-response` metadata into observer prompts.
- #14264 is a schema-compat follow-up, not a skip: it fixed false `z.toJSONSchema is not available` failures by broadening Zod export-shape resolution and adding `@typescript-eslint/no-require-imports`. Current HEAD has later schema-compat loader follow-ups (#14268/#14275/#14401/#14617 in file history), so the feature card records #14264's intent and current drift risk rather than treating its exact `createRequire` fallback as current source.

Documentation actions:

- Updated `features/memory/observational-memory.md` with `previousObserverTokens`, buffered-reflection replacement, prior metadata hints, state ownership, tests, and risk.
- Updated `features/models/tool-schema-compatibility.md` with #14264 and Zod module export-shape risk.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14167 skipped, #13568 done, #14264 done, #14201 current.

Focused evidence read: PR metadata for #14167/#13568/#14264; current `observational-memory.ts`, `observer-agent.ts`, `types.ts`, `observational-memory.test.ts`; current `standard-schema.ts`, `zod-v4.ts`, `zod-v4.test.ts`; `git show c562ec228f` for the #14264 adapter/package/lint diff; `git log` on `zod-v4.ts` showing later loader/draft-target follow-ups.

### PR #14201 / #14266 / #14250 feature-map checkpoint

Verified rows 128-130:

- #14201 and #14266 are Changesets alpha/version-package batches touching `.changeset/pre.json`, package `CHANGELOG.md`, and `package.json` files only; skipped for feature mapping.
- #14250 refined Mastra Code queued follow-up UX. PR intent: Enter queued follow-ups while an agent was streaming, queued messages and slash commands drained FIFO, queued text entered editor history, slash-command autocomplete selected the first visible match, custom slash commands used `//` precedence, and status line showed queued count.
- Current HEAD has evolved after #14250: active-run Enter text now goes through Harness `sendSignal()` (`signalMessage()`), active-run slash commands run immediately, and Ctrl+F is the explicit FIFO queue shortcut. Image follow-ups still queue when active-run signal routing cannot safely carry pending pasted images. The feature page now records both #14250's queue refinements and the current post-#14250 signal/queue split.

Documentation actions:

- Updated `features/chat/queued-followups.md` with #14250, current Enter/Ctrl+F behavior, FIFO state ownership, queued-count status, pending slash-message cleanup, signal-message state, and focused tests.
- Updated `features/tui/help-and-shortcuts.md` with #14250 shortcut labels (`Enter` send, `Ctrl+F` queue follow-up).
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14201 skipped, #14266 skipped, #14250 done, #13573 current.

Focused evidence read: PR metadata/body/diff for #14250; current `mastra-tui.ts` (`getUserInput()`, `signalMessage()`, `queueFollowUpMessage()`), `setup.ts` Enter/Ctrl+F handlers, `agent-lifecycle.ts` `drainQueuedAction()`, `custom-editor.ts` autocomplete completion and first-match logic, `status-line.ts` queued-count label; tests in `mastra-tui-queueing.test.ts`, `custom-editor.test.ts`, `status-line.test.ts`, and `help-overlay.test.ts`.

### PR #13573 / #14260 / #14280 feature-map checkpoint

Verified rows 131-133:

- #13573 adds missing provider API-key prompts to Mastra Code model-selection flows. Current source uses `promptForApiKeyIfNeeded()` from `/models`, `/om`, and subagent model selection; shows a masked `ApiKeyDialogComponent`; stores submitted keys through `AuthStorage.setStoredApiKey(provider, key, envVar)` under `apikey:<provider>`; and loads stored keys into `process.env` on startup without overriding real env vars. Headless `--model` validation fails early with the env-var hint instead of opening an interactive prompt.
- #14260 is dependency/build-only for this Mastra Code feature map. The `mastracode/package.json` changes are dependency range/addition updates; the real SDK compatibility source changes are in `packages/mcp`, outside the MC user-feature queue.
- #14280 is a Changesets alpha/version-package batch touching changelogs/package manifests; skipped for feature mapping.

Documentation actions:

- Updated `features/models/model-auth-and-modes.md` with #13573 API-key prompt/storage behavior, state ownership, key files, tests, missing tests, and env-precedence risk.
- Updated `features/settings/onboarding-and-global-settings.md` with stored-key startup/env loading and model-selection prompt interactions.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #13573 done, #14260 dependency/build-only skip, #14280 skipped, #14337 current.

Focused evidence read: PR metadata/diffs for #13573/#14260/#14280; current `auth/storage.ts`, `prompt-api-key.ts`, `components/api-key-dialog.ts`, `components/model-selector.ts`, `commands/models-pack.ts`, `commands/om.ts`, `commands/subagents.ts`, `headless.ts`, `index.ts`, `packages/mcp/src/client/client.ts`, `packages/mcp/src/server/server.ts`, and `packages/mcp/src/server/types.ts`; tests/fixtures from `model.test.ts`, `index.test.ts`, and command mocks around prompt/API-key storage.

### PR #14337 / #13933 / #14359 feature-map checkpoint

Verified rows 134-136:

- #14337 expands terminal theme/styling behavior: startup still resolves `MASTRA_THEME` > persisted preference > auto-detection, `detect-theme.ts` queries OSC 11 and falls back to `COLORFGBG`, `theme.ts` computes adapted brand/surface/theme colors against detected backgrounds, enforces 5.5:1 text and 4.5:1 brand contrast targets, applies OSC 10 foreground color, and restores foreground via OSC 110 on exit. The PR also refines status-line, tool, assistant, user-message, overlay, and editor colors through shared theme helpers.
- #13933 is build-tool dependency churn in Mastra Code scope (`mastracode/package.json` only); skipped for feature mapping.
- #14359 replaces the editor border's per-character animated gradient with a single cached solid mode-color `chalk.hex()` path in `CustomEditor.render()`, avoiding ~150-200 unique ANSI RGB sequences per frame and terminal corruption while keeping short status/prompt gradient animation intact.

Documentation actions:

- Updated `features/tui/terminal-theme.md` with #14337/#14359, adapted palette state ownership, solid editor border ownership, key files, tests, missing test gap, and ANSI-gradient regression risk.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14337 done, #13933 build-tool dependency skip, #14359 done, #14377 current.

Focused evidence read: PR metadata for #14337/#13933/#14359; current `main.ts`, `detect-theme.ts`, `theme.ts`, `commands/theme.ts`, `custom-editor.ts`, `status-line.ts`, `state.ts`, `setup.ts`, `obi-loader.ts`, `assistant-message.ts`, `user-message.ts`, `tool-execution-enhanced.ts`; tests in `theme-contrast.test.ts` and `status-line.test.ts`; `git show --name-status 531607166e -- mastracode` for the #13933 dep-only skip.

Verification:

- Accidental broad package-script run: `corepack pnpm --filter ./mastracode test -- --run src/tui/__tests__/theme-contrast.test.ts src/tui/__tests__/status-line.test.ts src/tui/components/__tests__/custom-editor.test.ts --bail=1 --reporter=dot` routed through the package script and ran the full Mastra Code suite, reproducing known baseline failures (`goal-manager.test.ts` Zod/nanoid snapshot drift and stale `/github sync` autocomplete ordering). Result: 5 files failed / 103 passed, 1221 tests passed before exit, 81.58s.
- Correct focused run: `corepack pnpm --filter ./mastracode exec vitest run src/tui/__tests__/theme-contrast.test.ts src/tui/__tests__/status-line.test.ts src/tui/components/__tests__/custom-editor.test.ts --bail=1 --reporter=dot` — 3 files / 67 tests passed in 495ms.

### PR #14377 / #14343 / #14427 feature-map checkpoint

Verified rows 137-139:

- #14377 improves MCP server management in Mastra Code: `/mcp` now defaults to `McpSelectorComponent`, showing configured and skipped servers, transports, tool counts, connecting/connected/failed state, per-server submenus, tool/error/log detail views, reload-all, and reconnect-one. `MastraTUI` starts `mcpManager.initInBackground()` after the UI starts so failed/skipped notices are inserted without corrupting terminal startup. `createMcpManager()` now exposes `initInBackground()`, `reconnectServer(name)`, `getServerLogs(name)`, and transient `connecting` statuses while preserving programmatic extra-server reload behavior.
- #14343 and #14427 are version-package alpha skips (CHANGELOG.md + package.json only in the PR file lists).

Documentation actions:

- Updated `features/integrations/mcp-status-command.md` with #14377 selector UX, background init, reload/reconnect, log views, state ownership, key files, tests, and missing selector component tests.
- Updated `features/integrations/mcp-server-configuration.md` with #14377 runtime state/log/reconnect ownership and MCP package client dependency note.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14377 done, #14343 skipped, #14427 skipped, #14432 current.

Focused evidence read: PR metadata for #14377/#14343/#14427; current `mastracode/src/tui/commands/mcp.ts`, `tui/components/mcp-selector.ts`, `tui/mastra-tui.ts`, `mcp/manager.ts`, `mcp/types.ts`, `mcp/__tests__/manager.test.ts`; package-local `packages/mcp/AGENTS.md`; current `packages/mcp/src/client/client.ts` and `client/configuration.ts` for HTTP transport/client compatibility context.

### PR #14432 / #14433 / #14469 feature-map checkpoint

Verified rows 140-142:

- #14432 is CI/turbo-cache configuration only for this feature map. It updates `turbo.json`, GitHub workflow concurrency/cache inputs, and package/store turbo configs; no Mastra Code runtime behavior changed.
- #14433 forwards Harness conversation identity into model-provider paths. `resolveModel()` derives `x-thread-id`/`x-resource-id` from requestContext and passes them to custom providers, direct API-key providers, gateway-routed models, GitHub Copilot, Moonshot, and (at the time) Claude Max/Codex OAuth wrappers. Core LLM execution also merges memory headers with model config headers and `modelSettings.headers`, with `modelSettings` winning duplicates.
- #14469 temporarily narrowed the Claude Max/Codex OAuth provider path by removing custom headers from those provider constructors because those APIs could reject unexpected headers. Current HEAD later evolved in #14952: provider/header plumbing was reintroduced around gateway routing and OAuth fetch helpers, so the feature cards record both the historical #14469 guard and current-source drift.

Documentation actions:

- Updated `features/models/model-auth-and-modes.md` with #14433/#14469, Harness header ownership, gateway/custom-provider consumers, key files, tests, missing test gap, and provider-header risk.
- Updated `features/models/custom-providers.md` with #14433 custom-provider header forwarding.
- Updated `features/integrations/harness-api.md` with core LLM execution header merge behavior.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14432 CI/turbo skip, #14433 done, #14469 done, #14423 current.

Focused evidence read: PR metadata/diffs for #14432/#14433/#14469; current `mastracode/src/agents/model.ts`, `agents/memory.ts`, `providers/claude-max.ts`, `providers/openai-codex.ts`, `agents/__tests__/model.test.ts`, `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`, `llm-execution-step.test.ts`; `git show c2e48b6a72` and `git show c8c86aa145` to reconcile #14469 with later current-source provider header reintroduction.

Verification:

- `corepack pnpm --filter ./packages/core exec vitest run src/loop/workflows/agentic-execution/llm-execution-step.test.ts --bail=1 --reporter=dot` — 1 file / 18 tests passed.
- `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u MASTRA_GATEWAY_API_KEY -u MOONSHOT_AI_API_KEY corepack pnpm --filter ./mastracode exec vitest run src/agents/__tests__/model.test.ts --bail=1 --reporter=dot` — 1 file / 36 tests passed. Unsanitized local env reproduced the known model-test env leakage: `OPENAI_API_KEY` makes the no-auth test take the direct OpenAI API-key path.

### PR #14423 / #14428 / #14472 / #14436 feature-map checkpoint

Verified rows 143-146:

- #14423 polished the TUI editor/history/chat visual path. Current HEAD no longer has the PR's standalone `history-popup.ts` / `prompt-animation.ts` files; the verified behavior is consolidated into `CustomEditor` prompt animation, `GradientAnimator` / `applyGradientSweep()`, message framing, status/OM progress styling, and related custom-editor tests.
- #14428 speeds `/threads` by caching message previews in TUI state, invalidating stale previews by `updatedAt`, debouncing preview loads, batching preview fetches, and showing cached previews while uncached previews load lazily.
- #14472 removes italic styling from tool arguments in the normal and quiet tool renderers while preserving the argument color tint.
- #14436 adds optional observer-generated thread titles. MC enables `threadTitle: true`; core OM conditionally prompts for `<thread-title>`, parses it into chunks/metadata, persists it through guarded `updateThread()` calls, emits `data-om-thread-update`, and the TUI renders `om_thread_title_updated` markers/status changes.

Documentation actions:

- Updated `features/tui/interactive-chat.md`, `features/threads/persistent-conversations.md`, `features/tools/streaming-tool-arguments.md`, and `features/memory/observational-memory.md`.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14423 done, #14428 done, #14472 done, #14436 done, #14479 current.

Focused evidence read: PR metadata/diffs for #14423/#14428/#14472/#14436; current `custom-editor.ts`, `user-message.ts`, `om-progress.ts`, `obi-loader.ts`, `assistant-message.ts`, `status-line.ts`, `thread-selector.ts`, `commands/threads.ts`, `event-dispatch.ts`, `handlers/om.ts`, `components/om-marker.ts`, `tool-execution-enhanced.ts`, `agents/memory.ts`, core Harness OM marker translation, `observer-agent.ts`, `observational-memory.ts`, and related tests in `custom-editor.test.ts`, `thread-selector.test.ts`, `threads.test.ts`, and `observational-memory.test.ts`.

Verification:

- `corepack pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/custom-editor.test.ts src/tui/components/__tests__/thread-selector.test.ts src/tui/commands/__tests__/threads.test.ts src/tui/components/__tests__/tool-execution-enhanced.test.ts --bail=1 --reporter=dot` — 4 files / 83 tests passed.
- `corepack pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/observational-memory.test.ts --bail=1 --reporter=dot -t "thread title|threadTitle|thread-title"` — 1 file / 5 tests passed / 445 skipped.

### PR #14479 / #14439 / #14437 feature-map checkpoint

Verified rows 147-149:

- #14479 fixes inline question answer rendering by wrapping long free-text submitted answers inside the bordered prompt box with continuation indentation. Current source uses `wrapTextWithAnsi()` before colorizing answer text in `ask-question-inline.ts`, preventing terminal-width overflow for answered prompt history/live render.
- #14439 is Changesets alpha package-version churn only; skipped for feature mapping.
- #14437 adds OM retrieval/recall. Retrieval mode registers the `recall` memory tool, wraps observed output in durable `<observation-group id range>` provenance, renders group headings/ranges into observation context, and provides thread/resource-scoped source-message lookup with semantic search, cursor/range hints, pagination, high-detail part fetching, and strict access guards.

Documentation actions:

- Updated `features/tui/interactive-prompts.md` with #14479 long-answer wrapping state/tests/risks.
- Updated `features/memory/observational-memory.md` with #14437 retrieval/recall provenance, `om-tools.ts`, observation-group helpers, tests, and recall access-guard risks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14479 done, #14439 skipped, #14437 done, #14541 current.

Focused evidence read: PR metadata for #14479/#14439/#14437; current `mastracode/src/tui/components/ask-question-inline.ts`, `ask-question-inline-long-labels.test.ts`, `mastracode/src/agents/memory.ts`, `packages/memory/src/index.ts`, `packages/memory/src/tools/om-tools.ts`, `om-tools.test.ts`, `packages/memory/src/processors/observational-memory/anchor-ids.ts`, `observation-groups.ts`, `observational-memory.ts`, and OM constants/retrieval instructions.

Verification:

- `corepack pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/ask-question-inline-long-labels.test.ts --bail=1 --reporter=dot` — 1 file / 3 tests passed.
- `corepack pnpm --filter ./packages/memory exec vitest run src/tools/om-tools.test.ts --bail=1 --reporter=dot` — 1 file / 91 tests passed.
- `corepack pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/observational-memory.test.ts --bail=1 --reporter=dot -t "anchor|observation group|retrieval"` — 1 file / 13 tests passed / 437 skipped.

### PR #14541 / #14518 / #14587 feature-map checkpoint

Verified rows 150-152:

- #14541 pins Mastra Code package dependency specifiers by replacing `latest` ranges in `mastracode/package.json` with explicit semver ranges and matching `pnpm-lock.yaml` changes. Current `mastracode/package.json` has no remaining `latest` specifiers.
- #14518 is Changesets alpha package-version churn for `mastracode`; skipped for feature mapping.
- #14587 expands the base system prompt with common-sense autonomy, decision, communication, and ask/don't-ask guidance. It also changes `buildFullPrompt()` to assemble non-empty sections (`base`, current tasks, agent instructions, model-specific prompt, mode prompt) with blank-line separators and adds `modelSpecificPrompts` keyed by exact model ID. Current HEAD includes prompts for `openai/gpt-5.4` and `openai/gpt-5.5`.

Documentation actions:

- Updated `features/setup/installation-and-launch.md` with #14541 dependency-range ownership and install reproducibility risk.
- Updated `features/chat/prompt-context.md` with #14587 autonomy guidance, model-specific prompt sections, assembly ownership, tests, and exact-ID risk.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14541 done, #14518 skipped, #14587 done, #14586 current.

Focused evidence read: PR metadata/diffs for #14541/#14518/#14587; current `mastracode/package.json`, `mastracode/src/agents/prompts/base.ts`, `index.ts`, `model.ts`, and `mastracode/src/agents/__tests__/prompts.test.ts`.

Verification:

- `corepack pnpm --filter ./mastracode exec vitest run src/agents/__tests__/prompts.test.ts --bail=1 --reporter=dot` — 1 file / 6 tests passed.

### PR #14586 / #14604 / #14605 feature-map checkpoint

Verified rows 153-155:

- #14586 starts macOS `caffeinate -i -m` on `agent_start` and kills it on every `agent_end` path plus TUI `stop()`. It is gated to Darwin and disabled by `MASTRACODE_DISABLE_CAFFEINATE=1`, with duplicate-process suppression and child error/exit cleanup.
- #14604 updates Mastra Code built-in OpenAI mode/OM packs. Current source uses `openai/gpt-5.5` for build/plan and `openai/gpt-5.4-mini` for fast/OM; settings and pack tests assert those IDs.
- #14605 removes the Claude Max OAuth warning/acknowledgement flow. Current login/onboarding code no longer has `claudeMaxOAuthWarningAcknowledgedAt` state or warning overlay files, so auth proceeds through the normal login dialog path.

Documentation actions:

- Updated `features/setup/installation-and-launch.md` and `features/integrations/lifecycle-hooks.md` with #14586 active-run sleep prevention and cleanup ownership.
- Updated `features/models/model-auth-and-modes.md` and `features/settings/onboarding-and-global-settings.md` with #14604 OpenAI defaults and #14605 warning removal.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14586 done, #14604 done, #14605 done, #14549 current.

Focused evidence read: PR metadata/diffs for #14586/#14604/#14605; current `mastracode/src/tui/mastra-tui.ts`, `mastracode/src/tui/__tests__/mastra-tui-hooks.test.ts`, `mastracode/src/onboarding/packs.ts`, `mastracode/src/onboarding/settings.ts`, `mastracode/src/onboarding/__tests__/settings.test.ts`, `mastracode/src/auth/storage.ts`, `mastracode/src/tui/commands/login.ts`, and `mastracode/src/onboarding/onboarding-inline.ts`.

Verification:

- `corepack pnpm --filter ./mastracode exec vitest run src/tui/__tests__/mastra-tui-hooks.test.ts --bail=1 --reporter=dot` — 1 file / 15 tests passed after adding the missing `execFile` export to the test's `node:child_process` mock.
- `corepack pnpm --filter ./mastracode exec vitest run src/onboarding/__tests__/packs.test.ts src/onboarding/__tests__/settings.test.ts --bail=1 --reporter=dot` — 2 files / 30 tests passed.

### PR #14549 / #14654 / #14688 feature-map checkpoint

Verified rows 156-158:

- #14549 is Changesets alpha package-version churn across packages, including `mastracode/CHANGELOG.md` and `mastracode/package.json`; skipped for feature mapping.
- #14654 is another Changesets alpha package-version batch; skipped for feature mapping.
- #14688 refines Mastra Code response guidance in the base prompt: Tone/Style moved from the top to the end of `buildBasePrompt()` so terminal-friendly directness remains salient, and the common-sense wording was tightened. Current source has this placement plus later-evolved prompt sections.

Documentation actions:

- Updated `features/chat/prompt-context.md` with #14688 base prompt placement/wording and tests/risks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14549 skipped, #14654 skipped, #14688 done, #14690 current.

Focused evidence read: PR metadata/diffs for #14549/#14654/#14688; current `mastracode/src/agents/prompts/base.ts` and `mastracode/src/agents/__tests__/prompts.test.ts`.

Verification:

- `corepack pnpm --filter ./mastracode exec vitest run src/agents/__tests__/prompts.test.ts --bail=1 --reporter=dot` — 1 file / 6 tests passed.

### PR #14690 / #14691 / #14565 feature-map checkpoint

Verified rows 159-161:

- #14690 makes `/threads` list all resources and keeps the selector responsive by relying on sorted thread metadata plus cached previews rather than blocking thread browsing.
- #14691 removes live thread-selector preview lookup. Current `handleThreadsCommand()` passes a `getMessagePreviews` callback that returns only `state.threadPreviewCache` hits and explicitly does not call `getFirstUserMessagesForThreads`; stale cache entries are invalidated by `updatedAt`.
- #14565 adds the `lsp_inspect` workspace tool. Current core source validates exactly one `<<<` marker, prepares a per-file LSP query, returns hover/line diagnostics/definition/implementation results, closes the document afterward, maps the tool to Mastra Code's `lsp_inspect` name, marks it read-category, documents prompt guidance, and renders a dedicated TUI box.

Documentation actions:

- Updated `features/threads/persistent-conversations.md` with all-resource thread listing, cache-only preview/title display, tests, and stale-title risks.
- Updated `features/tools/workspace-tools.md` and `features/tools/coding-tools-permissions.md` with `lsp_inspect` tool ownership, registration, prompt/permission/TUI surfaces, tests, and LSP availability risks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14690 done, #14691 done, #14565 done, #14637 current.

Focused evidence read: PR metadata/diffs for #14690/#14691/#14565; current `mastracode/src/tui/commands/threads.ts`, `threads.test.ts`, `mastracode/src/tui/components/thread-selector.ts`, `thread-selector.test.ts`, `packages/core/src/workspace/tools/lsp-inspect.ts`, `lsp-inspect.test.ts`, `packages/core/src/workspace/lsp/client.ts`, `manager.ts`, `packages/core/src/workspace/tools/tools.ts`, `mastracode/src/tool-names.ts`, `permissions.ts`, `agents/prompts/tool-guidance.ts`, and `tui/components/tool-execution-enhanced.ts`.

Verification:

- `corepack pnpm --filter ./mastracode exec vitest run src/tui/commands/__tests__/threads.test.ts src/tui/components/__tests__/thread-selector.test.ts --bail=1 --reporter=dot` — 2 files / 6 tests passed.
- `corepack pnpm --filter ./packages/core exec vitest run src/workspace/tools/__tests__/lsp-inspect.test.ts --bail=1 --reporter=dot` — 1 file / 13 tests passed / no type errors.

### PR #14637 / #14727 / #14567 feature-map checkpoint

Verified rows 162-164:

- #14637 adds dynamic nested instruction loading. Current source wires `AgentsMDInjector` as a core input processor, ignores statically loaded global/project instruction files, scans path-bearing tool calls for nearest `AGENTS.md`/`CLAUDE.md`/`CONTEXT.md`, dedupes by metadata/path, emits `dynamic-agents-md` system reminders, renders them in the TUI, and tells OM not to observe those ephemeral reminders.
- #14727 fixes custom slash-command loading. Current `slash-command-loader.ts` scans OpenCode/Claude/Mastra user and project directories in priority order, derives names/namespaces from paths or frontmatter, parses templates, and uses Map-based dedupe so later higher-priority sources override earlier duplicates.
- #14567 expands OM recall to cross-thread browsing/search with scope-based access control. Current `recall` defaults message browsing to the current thread, validates explicit `threadId` values against the active resource, allows cursor-only same-resource browsing, exposes resource thread listing/search, indexes observation groups into the selected vector store, and adds `/thread` to show active thread/resource/fork provenance.

Documentation actions:

- Updated `features/chat/prompt-context.md` with dynamic AGENTS/CLAUDE/CONTEXT reminders, `AgentsMDInjector` ownership, TUI rendering, tests, and dedupe/truncation risks.
- Updated `features/chat/queued-followups.md` with #14727 custom slash-command loading/discovery priority and tests.
- Updated `features/memory/observational-memory.md` with #14567 cross-thread recall/search/indexing, vector metadata ownership, `/thread`, tests, and storage/vector risks.
- Updated `features/threads/persistent-conversations.md` with `/thread` current-thread/fork provenance behavior.
- Updated `features/settings/storage-backend.md` with recall vector-store pairing.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14637 done, #14727 done, #14567 done, #14788 current.

Focused evidence read: PR metadata/diffs for #14637/#14727/#14567; current `mastracode/src/agents/prompts/agent-instructions.ts`, `packages/core/src/processors/tool-result-reminder.ts`, `mastracode/src/tui/components/system-reminder.ts`, `mastracode/src/tui/message.ts`, `mastracode/src/index.ts`, `mastracode/src/utils/slash-command-loader.ts`, `mastracode/src/tui/command-dispatch.ts`, `packages/memory/src/tools/om-tools.ts`, `packages/memory/src/index.ts`, `packages/memory/src/processors/observational-memory/observation-strategies/*`, `mastracode/src/agents/memory.ts`, `mastracode/src/utils/storage-factory.ts`, `mastracode/src/tui/commands/thread.ts`, and related tests.

Verification:

- `corepack pnpm --filter ./packages/core exec vitest run src/processors/tool-result-reminder.test.ts --bail=1 --reporter=dot` — 1 file / 14 tests passed / no type errors.
- `corepack pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/system-reminder.test.ts src/utils/__tests__/slash-command-loader.test.ts src/tui/commands/__tests__/thread.test.ts --bail=1 --reporter=dot` — 3 files / 17 tests passed.
- `corepack pnpm --filter ./packages/memory exec vitest run src/tools/om-tools.test.ts --bail=1 --reporter=dot` — 1 file / 91 tests passed.

### PR #14788 / #14790 / #14845 feature-map checkpoint

Verified rows 165-167:

- #14788 persists observational-memory threshold settings across restarts. Current source stores `omObservationThreshold` and `omReflectionThreshold` in global settings, seeds Harness initial state at startup, writes settings from `/om` threshold callbacks, and restores/backfills per-thread threshold metadata in the core Harness.
- #14790 caps dynamically injected AGENTS/CLAUDE/CONTEXT reminders. Current `AgentsMDInjector` uses `tokenx` token estimation, truncates at newline boundaries with a visible marker, defaults to about 1000 tokens, dedupes by metadata/path, and Mastra Code memory instructions tell OM not to observe those ephemeral reminders.
- #14845 allows custom responses for single-select questions with options. Current inline and dialog question components append a `Custom response...` option when allowed, switch from select mode to free-text input when selected, and omit the escape hatch for multi-select prompts.

Documentation actions:

- Updated `features/memory/observational-memory.md` with OM threshold persistence and dynamic-reminder exclusion/capping.
- Updated `features/settings/onboarding-and-global-settings.md` with global OM threshold defaults and startup/thread ownership.
- Updated `features/chat/prompt-context.md` with dynamic instruction reminder token caps and truncation behavior.
- Updated `features/tui/interactive-prompts.md` with custom-response option prompts.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14788 done, #14790 done, #14845 done, #14656 current.

Focused evidence read: PR metadata/diffs for #14788/#14790/#14845; current `mastracode/src/onboarding/settings.ts`, `mastracode/src/index.ts`, `mastracode/src/tui/commands/om.ts`, `packages/core/src/harness/harness.ts`, `packages/core/src/harness/om-threshold-persistence.test.ts`, `packages/core/src/processors/tool-result-reminder.ts`, `tool-result-reminder.test.ts`, `mastracode/src/agents/memory.ts`, `mastracode/src/tui/components/ask-question-inline.ts`, `ask-question-dialog.ts`, and inline question tests.

Verification:

- `corepack pnpm --filter ./packages/core exec vitest run src/harness/om-threshold-persistence.test.ts --bail=1 --reporter=dot` — 1 file / 2 tests passed / no type errors.
- `corepack pnpm --filter ./packages/core exec vitest run src/processors/tool-result-reminder.test.ts --bail=1 --reporter=dot` — 1 file / 14 tests passed / no type errors.
- `corepack pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/ask-question-inline-long-labels.test.ts src/tui/components/__tests__/ask-question-inline-multi-select.test.ts src/tui/components/__tests__/ask-question-inline-multiline.test.ts --bail=1 --reporter=dot` — 3 files / 15 tests passed.

### PR #14656 / #14867 / #14804 feature-map checkpoint

Verified rows 168-170:

- #14656 is Changesets alpha package-version churn across Mastra packages; skipped for feature mapping.
- #14867 fixes gateway provider type generation for provider IDs that start with digits (for example `302ai`). Current MastraCode gateway sync delegates to core `GatewayRegistry`; the current source of truth is `packages/core/src/llm/model/registry-generator.ts`, where `generateTypesContent()` quotes keys that are not valid JavaScript identifiers.
- #14804 fixes `/subagents` so configured subagents from `createMastraCode({ subagents })` appear in the type picker. Current source maps configured `{ id, name, description }` entries to options and falls back to built-in Explore/Plan/Execute only when the config is absent or empty.

Documentation actions:

- Updated `features/models/model-auth-and-modes.md` with gateway registry generated-type ownership and digit-leading provider key quoting.
- Updated `features/subagents/delegation.md` with configured-subagent `/subagents` picker behavior and ID/name ownership risks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14656 skipped, #14867 done, #14804 done, #14535 current.

Focused evidence read: PR metadata/diffs for #14656/#14867/#14804; current `mastracode/src/utils/gateway-sync.ts`, `mastracode/src/utils/__tests__/gateway-sync.test.ts`, `packages/core/src/llm/model/registry-generator.ts`, `registry-generator.test.ts`, `mastracode/src/tui/commands/subagents.ts`, and `subagents.test.ts`.

Verification:

- `corepack pnpm --filter ./packages/core exec vitest run src/llm/model/registry-generator.test.ts --bail=1 --reporter=dot` — 1 file / 3 tests passed / no type errors.
- `corepack pnpm --filter ./mastracode exec vitest run src/utils/__tests__/gateway-sync.test.ts src/tui/commands/__tests__/subagents.test.ts --bail=1 --reporter=dot` — 2 files / 10 tests passed.

### PR #14535 / #14870 / #14904 feature-map checkpoint

Verified rows 171-173:

- #14535 prevents circular tool-result payloads from crashing JSON serialization. Current core source exports `safeStringify()` and `ensureSerializable()`, sanitizes raw tool execution results in `tool-call-step.ts`, and uses safe stringification in Harness/TUI/network rendering call sites so circular references become `[Circular]` markers.
- #14870 and #14904 are Changesets alpha package-version batches across packages; skipped for feature mapping.

Documentation actions:

- Updated `features/tools/coding-tools-permissions.md` with safe tool-result serialization ownership, key files, tests, and JSON-safety-vs-output-budgeting risks.
- Updated `features/tools/streaming-tool-arguments.md` with circular-result display behavior for completed tool boxes and history projections.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14535 done, #14870 skipped, #14904 skipped, #14911 current.

Focused evidence read: PR metadata/diffs for #14535/#14870/#14904; current `packages/core/src/utils.ts`, `utils.test.ts`, `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts`, Harness/TUI safeStringify call sites, and affected feature cards.

Verification:

- `corepack pnpm --filter ./packages/core exec vitest run src/utils.test.ts --bail=1 --reporter=dot` — 1 file / 66 tests passed / no type errors.

### PR #14911 / #14960 / #14961 feature-map checkpoint

Verified rows 174-176:

- #14911 is a Changesets alpha package-version batch across packages; skipped for feature mapping.
- #14960 disables the practical MCP tool-result timeout by passing `timeout: MASTRACODE_MCP_TIMEOUT_MS` (`7 * 24 * 60 * 60 * 1000`) into the MastraCode `MCPClient` constructor in `mastracode/src/mcp/manager.ts`, preserving existing status/tool/log/reconnect behavior while allowing long-running MCP tools to finish.
- #14961 updates base prompt File Access & Sandbox guidance so external-path access failures instruct the agent to call `request_access` instead of telling the user to run `/sandbox`.

Documentation actions:

- Updated `features/integrations/mcp-server-configuration.md` and `mcp-status-command.md` for the long MCP timeout owner, behavior, tests, and risks.
- Updated `features/chat/prompt-context.md` and `features/tools/workspace-tools.md` for request_access prompt guidance.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14911 skipped, #14960 done, #14961 done, #14929 current.

Focused evidence read: PR metadata/diffs for #14911/#14960/#14961; current `mastracode/src/mcp/manager.ts`, `mastracode/src/agents/prompts/base.ts`, `mastracode/AGENTS.md`, and related feature cards.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/mcp/__tests__/manager.test.ts src/agents/__tests__/prompts.test.ts --bail=1 --reporter=dot` — 2 files / 50 tests passed.
- Note: an earlier `pnpm --filter ./mastracode test -- --run ...` attempt accidentally invoked the broad MastraCode suite and failed in unrelated tests; the focused `exec vitest run` command above is the relevant checkpoint evidence.

### PR #14929 / #14952 / #14936 feature-map checkpoint

Verified rows 177-179:

- #14929 is a Changesets alpha package-version batch across packages; skipped for feature mapping.
- #14952 adds the Mastra Gateway model-router provider path and Memory Gateway integration. Current source routes explicit `mastra/<provider>/<model>` IDs through Memory Gateway when a stored/env gateway key exists, keeps OAuth Anthropic/Codex paths on direct providers with gateway auth headers, adds `/memory-gateway` API-key/base-URL configuration, and proxies server memory/OM routes for gateway-backed agents through `GatewayMemoryClient`.
- #14936 masks sensitive TUI input fields with `MaskedInput`, now used by API-key dialogs, login prompts, and storage backend connection-string entry.

Documentation actions:

- Updated `features/models/model-auth-and-modes.md` with #14952 Memory Gateway routing/settings/server proxy ownership and #14936 masked key/login prompts.
- Updated `features/memory/observational-memory.md` with gateway-backed memory/OM server proxy behavior, key files, tests, and missing server-route coverage.
- Updated `features/settings/onboarding-and-global-settings.md` with Memory Gateway settings ownership and masked settings prompts.
- Updated `features/tui/interactive-prompts.md` with sensitive input masking behavior and missing `MaskedInput` regression tests.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #14929 skipped, #14952 done, #14936 done, #14965 current.

Focused evidence read: PR metadata/diffs for #14929/#14952/#14936; current `mastracode/src/agents/model.ts`, `model.test.ts`, `mastracode/src/tui/commands/memory-gateway.ts`, `memory-gateway.test.ts`, `packages/server/src/server/handlers/gateway-memory-client.ts`, `memory.ts`, `agents.ts`, `mastracode/src/tui/components/masked-input.ts`, `api-key-dialog.ts`, `login-dialog.ts`, and `settings.ts`.

Verification:

- `env -u OPENAI_API_KEY -u MASTRA_GATEWAY_API_KEY pnpm --filter ./mastracode exec vitest run src/agents/__tests__/model.test.ts src/tui/commands/__tests__/memory-gateway.test.ts --bail=1 --reporter=dot` — 2 files / 40 tests passed.
- `pnpm --filter ./packages/core exec vitest run src/agent/__tests__/memory-gateway-duck-typing.test.ts --bail=1 --reporter=dot` — 1 file / 1 test passed / no type errors.
- `pnpm --filter ./packages/server exec vitest run src/server/handlers/memory.test.ts --bail=1 --reporter=dot` — 1 file / 85 tests passed.
- Note: the first MastraCode model run without env isolation failed because local `OPENAI_API_KEY` changed the intended no-auth branch; rerun above isolated provider env and passed.

### PR #14965 / #15034 / #15042 / #15055 / #15059 feature-map checkpoint

Verified rows 180-184:

- #14965, #15034, #15042, #15055, and #15059 are Changesets alpha package-version batches across packages. Each PR only touches `.changeset/pre.json`, package `CHANGELOG.md`, and package version fields, including `mastracode/CHANGELOG.md` and `mastracode/package.json`; no Mastra Code feature behavior to map.

Documentation actions:

- Updated `_pr-queue.md` rows 180-184 to `skipped` and advanced row 185 #15082 to `current`.
- Updated `handoff.md` to set the next checkpoint to #15082.
- Added this history entry.

Focused evidence read: `gh pr view` metadata/files for #14965/#15034/#15042/#15055/#15059.

Verification: no focused tests needed; skip-only package-version/docs churn.

### PR #15082 feature-map checkpoint

Verified row 185:

- #15082 adds long-session TUI chat pruning. Current `mastracode/src/tui/prune-chat.ts` caps `state.chatContainer.children` after lifecycle cleanup: when more than 200 rendered children exist, it removes the oldest children and keeps the most recent 100.
- The helper also removes pruned references from `allToolComponents`, `allSlashCommandComponents`, `allSystemReminderComponents`, `allShellComponents`, and `pendingSignalMessageComponentsById`.
- `mastracode/src/tui/handlers/agent-lifecycle.ts` calls `pruneChatContainer(state)` on normal `agent_end`, abort cleanup, and error cleanup. Pruning is TUI-only; persisted thread history remains in Harness/memory and reload reconstruction still comes from stored messages.
- PR also carried Harness API/type follow-up fixes in agent/headless/workspace paths; no separate user-visible feature behavior identified beyond chat pruning.

Documentation actions:

- Updated `features/tui/interactive-chat.md` with #15082 later-change history, current long-session pruning behavior, state ownership, key files, tests, missing lifecycle/map cleanup tests, and known risks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15082 done, #15036 current.

Focused evidence read: PR metadata/diff for #15082; current `mastracode/src/tui/prune-chat.ts`, `mastracode/src/tui/__tests__/prune-chat.test.ts`, `mastracode/src/tui/handlers/agent-lifecycle.ts`, `mastracode/src/tui/state.ts`, and tracked component insertion sites.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/prune-chat.test.ts --bail=1 --reporter=dot` — 1 file / 2 tests passed.

### PR #15036 / #15088 / #15083 / #15114 feature-map checkpoint

Verified rows 186-189:

- #15036 adds browser automation support for Mastra Code. Current source persists `BrowserSettings` in global settings, restores enabled browser instances at startup with `createBrowserFromSettings()`, passes Harness-level browser instances into mode agents, and exposes `/browser` status/on/off/set/clear/export plus an interactive setup wizard for Stagehand and Agent Browser providers.
- #15088 fixes review follow-ups: `/subagents` keeps configured subagent choices visible, startup seeds global subagent model defaults from `default` and `_default` settings keys, and chat pruning uses count-based `splice(0, removeCount)` to reliably keep the newest 100 rendered children.
- #15083 and #15114 are Changesets alpha package-version batches; skipped for feature mapping.

Documentation actions:

- Added `features/integrations/browser-automation.md` for #15036 browser settings, `/browser` command behavior, Harness/Agent browser ownership, tests, and risks.
- Updated `features/settings/onboarding-and-global-settings.md`, `features/tui/help-and-shortcuts.md`, and `features/integrations/harness-api.md` for browser settings/help/Harness propagation.
- Updated `features/subagents/delegation.md` and `features/tui/interactive-chat.md` for #15088 subagent default and prune follow-ups.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15036 done, #15088 done, #15083 skipped, #15114 skipped, #15151 current.

Focused evidence read: PR metadata/diffs for #15036/#15088/#15083/#15114; current `mastracode/src/tui/commands/browser.ts`, `mastracode/src/onboarding/settings.ts`, `mastracode/src/main.ts`, `mastracode/src/index.ts`, `mastracode/src/tui/commands/subagents.ts`, `mastracode/src/tui/prune-chat.ts`, `packages/core/src/harness/harness.ts`, `packages/core/src/agent/__tests__/browser.test.ts`, and `packages/core/src/browser/browser.test.ts`.

Verification:

- `pnpm --filter ./packages/core exec vitest run src/agent/__tests__/browser.test.ts src/browser/browser.test.ts --bail=1 --reporter=dot` — 2 files / 18 tests passed / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/tui/commands/__tests__/subagents.test.ts src/tui/__tests__/prune-chat.test.ts src/tui/components/__tests__/help-overlay.test.ts src/tui/__tests__/command-dispatch.test.ts --bail=1 --reporter=dot` — 4 files / 31 tests passed.

### PR #15151 / #15117 / #15165 / #15172 feature-map checkpoint

Verified rows 190-193:

- #15151 adds Agent Skills spec-compatible skill directory support. Current `buildSkillPaths()` scans project-local `.agents/skills` and global `~/.agents/skills` in addition to Mastra Code and Claude skill directories, includes those paths in workspace skills and inherited allowed paths, and updates `/skills` setup guidance with the Agent Skills locations.
- Current tests have evolved from the original `workspace-skill-paths.test.ts` file name into `build-skill-paths.test.ts` and `workspace-skill-activation.test.ts`, covering base path construction, symlink parent handling, and symlinked local skill activation through the Mastra Code workspace path.
- #15117, #15165, and #15172 are Changesets alpha package-version batches; skipped for feature mapping.

Documentation actions:

- Updated `features/integrations/skills-command.md` for Agent Skills directories, `/skills` setup text, state ownership, tests, and risks.
- Updated `features/tools/workspace-tools.md` for inherited allowed-path ownership including Agent Skills directories.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15151 done, #15117 skipped, #15165 skipped, #15172 skipped, #15092 current.

Focused evidence read: PR metadata/diffs for #15151/#15117/#15165/#15172; current `mastracode/src/agents/workspace.ts`, `mastracode/src/tui/commands/skills.ts`, `mastracode/src/agents/__tests__/build-skill-paths.test.ts`, `mastracode/src/agents/__tests__/workspace-skill-activation.test.ts`, and `mastracode/src/tools/__tests__/get-allowed-paths.test.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/agents/__tests__/build-skill-paths.test.ts src/agents/__tests__/workspace-skill-activation.test.ts src/tools/__tests__/get-allowed-paths.test.ts src/tui/commands/__tests__/skills.test.ts --bail=1 --reporter=dot` — 4 files / 24 tests passed.

### PR #15092 / #15174 / #14962 feature-map checkpoint

Verified rows 194-196:

- #15092 adds collapsible output for `!` shell passthrough commands. Current `ShellStreamComponent` stores up to 200 lines, shows the latest 20 lines when collapsed, exposes `setExpanded()` / `isExpanded()`, renders the Ctrl+E hint when output is truncated, and inherits `state.toolOutputExpanded` for newly created passthrough components.
- #15092 also adds `allShellComponents` to `TUIState`, includes shells in the Ctrl+E expansion loop, clears tracked shell components on thread/resource/new/clone transitions, and prunes stale shell components from `pruneChatContainer()`.
- #15174 is a Changesets alpha package-version batch; skipped for feature mapping.
- #14962 adds headless thread-control CLI options: `--continue`, `--thread` / `-t`, `--title`, `--clone-thread`, and `--resource-id`. `parseHeadlessArgs()` rejects `--continue` + `--thread`, resolves threads by exact ID then most-recent matching title, optionally clones before sending the prompt, renames the selected/current thread, and includes thread IDs in JSON summaries.

Documentation actions:

- Updated `features/tui/shell-passthrough.md` for #15092 collapse behavior, state ownership, tests, and risks.
- Updated `features/headless/prompt-mode.md` for #14962 thread/resource controls, CLI parsing, and integration tests.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15092 done, #15174 skipped, #14962 done, #15190 current.

Focused evidence read: PR metadata for #15092/#15174/#14962; current `mastracode/src/tui/components/shell-output.ts`, `mastracode/src/tui/shell.ts`, `mastracode/src/tui/setup.ts`, `mastracode/src/tui/prune-chat.ts`, `mastracode/src/tui/state.ts`, `mastracode/src/headless.ts`, `mastracode/src/headless.test.ts`, `mastracode/src/headless-integration.test.ts`, and shell/thread-control related test searches.

Verification:

- Initial broad focused command including full `setup-keyboard-shortcuts.test.ts` failed on the known unrelated GitHub autocomplete ordering assertion (`sync` present before `debug`).
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/shell.test.ts src/tui/__tests__/shell-result.test.ts src/tui/__tests__/prune-chat.test.ts src/headless.test.ts --bail=1 --reporter=dot` — 4 files / 54 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/setup-keyboard-shortcuts.test.ts -t "toggles system reminder expansion with Ctrl\\+E" --bail=1 --reporter=dot` — targeted Ctrl+E test passed (1 passed / 9 skipped).
- `pnpm --filter ./mastracode exec vitest run src/headless-integration.test.ts -t "headless mode — thread control" --bail=1 --reporter=dot` — targeted thread-control integration tests passed (5 passed / 18 skipped).

### PR #15190 / #15192 / #15191 / #15228 feature-map checkpoint

Verified rows 197-200:

- #15190 and #15191 are Changesets alpha package-version batches; skipped for feature mapping.
- #15192 clears stale task-list state on thread boundaries. Current `mastracode/src/tui/event-dispatch.ts` handles `thread_changed` and `thread_created` by clearing Harness state for `tasks`, `activePlan`, and `sandboxAllowedPaths`, resetting `state.taskToolInsertIndex`, and clearing the live task-progress component before rendering the new thread.
- #15228 resolves symlinked workspace skill aliases. Current core skill sources expose `realpath()`, local skill source readdir is symlink-aware, and `WorkspaceSkillsImpl` canonicalizes candidate skill directories before list/search/get tie-breaking so duplicate aliases of the same skill collapse while distinct same-named local skills still conflict.

Documentation actions:

- Updated `features/tools/task-tracking.md` for #15192 thread-boundary task/plan/access cleanup and tests.
- Updated `features/integrations/skills-command.md` and `features/tools/workspace-tools.md` for #15228 canonical skill alias resolution, symlink allowed-root behavior, key files, tests, and risks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15190 skipped, #15192 done, #15191 skipped, #15228 done, #15014 current.

Focused evidence read: PR metadata for #15190/#15192/#15191/#15228; current `mastracode/src/tui/event-dispatch.ts`, `mastracode/src/tui/event-dispatch.test.ts`, `packages/core/src/workspace/skills/workspace-skills.ts`, `workspace-skills.test.ts`, `skill-source.ts`, `local-skill-source.ts`, `composite-versioned-skill-source.ts`, `local-filesystem.ts`, and symlink/canonical skill test searches.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/event-dispatch.test.ts --bail=1 --reporter=dot` — 1 file / 11 tests passed.
- `pnpm --filter ./packages/core exec vitest run src/workspace/skills/workspace-skills.test.ts src/workspace/filesystem/local-filesystem.test.ts src/workspace/skills/tools.test.ts src/workspace/workspace.test.ts --bail=1 --reporter=dot` — 4 files / 386 tests passed / no type errors.

### PR #15014 / #14435 / #15194 feature-map checkpoint

Verified rows 201-203:

- #15014 adds `/api-keys` for provider API-key management. Current Mastra Code source lists providers from `harness.listAvailableModels()`, de-dupes by provider, labels env/stored/none status, opens the masked `ApiKeyDialogComponent` for add/update, deletes stored keys via AuthStorage, clears the runtime env projection, and exposes the flow from slash-command dispatch plus the Settings submenu.
- #14435 adds the core `processAPIError` processor hook and `PrefillErrorHandler`. Current core source detects Anthropic/Qwen assistant-prefill rejection messages from `error.message` or `APICallError.responseBody`, appends a hidden reactive `anthropic-prefill-processor-retry` system-reminder containing `continue`, and requests exactly one retry through the agent runner.
- #15194 adds browser `profile` and `executablePath` options. Current source validates browser settings, enforces CDP vs launch-time profile/executable mutual exclusion, creates profile dirs for launched browsers, tracks profile provider metadata, supports `/browser set`/`clear` flows, and keeps core profile lock-file cleanup/process-group kill helpers covered.

Documentation actions:

- Updated `features/models/model-auth-and-modes.md` and `features/tui/help-and-shortcuts.md` for `/api-keys` command behavior, state ownership, tests, missing tests, and command-list drift risks.
- Updated `features/chat/prompt-context.md` for `processAPIError`/`PrefillErrorHandler` retry reminders and associated runner/system-reminder behavior.
- Updated `features/integrations/browser-automation.md` and `features/settings/onboarding-and-global-settings.md` for profile/executable browser settings and `/api-keys` settings ownership.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15014 done, #14435 done, #15194 done, #15352 current.

Focused evidence read: PR metadata for #15014/#14435/#15194; current `mastracode/src/tui/commands/api-keys.ts`, command/settings wiring, `packages/core/src/processors/prefill-error-handler.ts`, `processors/index.ts`, `runner.ts`, prefill recovery tests, `mastracode/src/tui/commands/browser.ts`, `mastracode/src/onboarding/settings.ts`, and `packages/core/src/browser/browser.ts` / browser tests.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/command-dispatch.test.ts src/tui/components/__tests__/help-overlay.test.ts src/onboarding/__tests__/settings.test.ts --bail=1 --reporter=dot` — 3 files / 51 tests passed.
- `pnpm --filter ./packages/core exec vitest run src/processors/prefill-error-handler.test.ts src/processors/runner.test.ts src/agent/__tests__/prefill-error-recovery.test.ts --bail=1 --reporter=dot` — 3 files / 92 tests passed / no type errors.
- `pnpm --filter ./packages/core exec vitest run src/browser/browser.test.ts src/agent/__tests__/browser.test.ts --bail=1 --reporter=dot` — 2 files / 18 tests passed / no type errors.

### PR #15352 / #15359 / #15200 feature-map checkpoint

Verified rows 204-206:

- #15352 refines Mastra Code autonomy prompts. Current `base.ts` adds autonomy-first/common-sense guidance, an ask-vs-proceed decision framework, explicit must-ask/should-not-ask lists, and concise terminal response guidance; current `build.ts` asks the agent to stop and clarify only when materially different implementation approaches would change scope/behavior/risk, and to report blockers after reasonable attempts with what was tried plus the next best option.
- #15359 adds opt-in caveman OM compression. Current `memory.ts` conditionally adds `CAVEMAN_OM_INSTRUCTION` to observer/reflection instructions based on `state.cavemanObservations`; `/om` writes the toggle to harness state, thread metadata, and `settings.models.omCavemanObservations`; `thread-caveman-state.ts` mirrors/seeds per-thread `cavemanObservations` and `observeAttachments`; base prompt Memory Style warns compressed memories are storage-only and should not affect user-facing prose.
- #15200 is a Changesets alpha package-version batch; skipped for feature mapping.

Documentation actions:

- Updated `features/chat/prompt-context.md` for #15352 autonomy/common-sense prompt behavior and #15359 Memory Style guard.
- Updated `features/memory/observational-memory.md` for caveman OM compression, state ownership, key files, tests, missing tests, and style-leakage risks.
- Updated `features/settings/onboarding-and-global-settings.md` for persisted OM caveman defaults and thread/global ownership.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15352 done, #15359 done, #15200 skipped, #15370 current.

Focused evidence read: PR/current-source metadata for #15352/#15359/#15200; current `mastracode/src/agents/prompts/base.ts`, `build.ts`, `memory.ts`, `thread-caveman-state.ts`, `schema.ts`, `mastracode/src/tui/commands/om.ts`, settings schema, prompt tests, thread-caveman tests, and startup restore tests.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/agents/__tests__/prompts.test.ts src/agents/thread-caveman-state.test.ts --bail=1 --reporter=dot` — 2 files / 15 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/__tests__/index.test.ts -t "caveman observation setting" --bail=1 --reporter=dot` — targeted startup caveman restore tests passed (2 passed / 14 skipped).

### PR #15370 / #15390 / #14909 / #15365 feature-map checkpoint

Verified rows 207-210:

- #15370 adds custom model-pack share/import. Current `models-pack.ts` serializes custom packs into `mastra-pack:` base64 payloads, deserializes and validates pasted payloads, copies shared payloads through the platform clipboard helper with inline fallback, validates imported model IDs against available models, and handles name collisions with overwrite/rename/cancel choices.
- #15390 is a Changesets alpha package-version batch; skipped for feature mapping.
- #14909 adds headless `--model` / `--settings` behavior. Current `headless.ts` uses the shared settings/AuthStorage path, validates requested models against `harness.listAvailableModels()`, reports unknown/missing-key failures before `agent_start`, warns when `--model` overrides `--mode`, and treats MCP init failures as headless warnings instead of startup crashes.
- #15365 adds OM `activateAfterIdle`. Current core memory accepts number/duration-string/`auto`/`false` TTLs, resolves `auto` through provider/model cache-retention heuristics, computes last activity from message/part timestamps, activates buffered observations/reflections when idle TTL expires, and emits `om_activation` markers with `triggeredBy`, `activateAfterIdle`, `lastActivityAt`, and `ttlExpiredMs` attribution.

Documentation actions:

- Updated `features/models/model-auth-and-modes.md` for model-pack share/import payload ownership, `--model` headless preflight, key files, tests, missing tests, and import risks.
- Updated `features/headless/prompt-mode.md` for #14909 CLI flags, shared settings, preflight behavior, warning/output contracts, and test coverage.
- Updated `features/memory/observational-memory.md` for #15365 idle activation TTL ownership, key files, tests, missing tests, and timestamp/storage risks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15370 done, #15390 skipped, #14909 done, #15365 done, #15420 current.

Focused evidence read: PR metadata for #15370/#15390/#14909/#15365; current `mastracode/src/tui/commands/models-pack.ts`, clipboard helper, model-pack tests, `mastracode/src/headless.ts`, `headless.test.ts`, `headless-integration.test.ts`, `packages/memory/src/processors/observational-memory/observational-memory.ts`, `activation-ttl.ts`, OM event/marker handlers, memory config tests, TTL tests, and TUI marker tests.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/commands/__tests__/models-pack.test.ts src/headless.test.ts --bail=1 --reporter=dot` — 2 files / 59 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/headless-integration.test.ts -t "headless mode — --model flag" --bail=1 --reporter=dot` — targeted `--model` integration tests passed (8 passed / 15 skipped).
- `pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/activation-ttl.test.ts src/processors/observational-memory/__tests__/idle-buffering.test.ts --bail=1 --reporter=dot` — 2 files / 13 tests passed.
- `pnpm --filter ./packages/core exec vitest run src/memory/memory-config.test.ts --bail=1 --reporter=dot` — 1 file / 7 tests passed / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/om-marker.test.ts --bail=1 --reporter=dot` — 1 file / 5 tests passed.
- `pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/observational-memory-api.test.ts -t "activateAfterIdle" --bail=1 --reporter=dot` — targeted activateAfterIdle API tests passed (10 passed / 135 skipped).

### PR #15420 / #15458 / #15462 / #15483 feature-map checkpoint

Verified rows 211-214:

- #15420 adds provider/model-change observation activation. Current Mastra Code memory defaults set `activateAfterIdle: 'auto'` and `activateOnProviderChange: true`; core OM detects the last stored model from `step-start`/metadata, compares it to the current actor model, prioritizes provider-change activation over TTL/threshold, and emits `om_activation` metadata with `triggeredBy: 'provider_change'`, `previousModel`, and `currentModel`.
- #15458 bumps Anthropic built-in pack defaults. Current `packs.ts` uses `anthropic/claude-opus-4-7` for OAuth build/plan, `anthropic/claude-sonnet-4-6` for API-key build/plan, and keeps `anthropic/claude-haiku-4-5` for fast mode.
- #15462 prevents early buffered-reflection activation overshoot. Current `reflector-runner.ts` suppresses TTL/provider-change reflection swaps when the unreflected tail is smaller than the buffered reflection or the combined token count is below 75% of the normal activation target; `model-context.ts` also normalizes bare vs provider-prefixed model IDs so equivalent model IDs do not falsely trigger provider-change activation.
- #15483 fixes stored API-key fallback. Current `getAnthropicApiKey()` and `getOpenAIApiKey()` check the main credential slot, then `authStorage.getStoredApiKey(providerId)`, then `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`.

Documentation actions:

- Updated `features/memory/observational-memory.md` for provider-change activation, provider-change marker state, normalized model comparison, and early reflection overshoot guards.
- Updated `features/models/model-auth-and-modes.md` for Anthropic pack defaults and Anthropic/OpenAI stored-key fallback order.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15420 done, #15458 done, #15462 done, #15483 done, #15403 current.

Focused evidence read: PR metadata for #15420/#15458/#15462/#15483; current `mastracode/src/agents/memory.ts`, `mastracode/src/onboarding/packs.ts`, `mastracode/src/agents/model.ts`, `packages/memory/src/processors/observational-memory/observational-memory.ts`, `reflector-runner.ts`, `model-context.ts`, OM activation TUI handlers/markers, and focused test files.

Verification:

- `pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/observational-memory.test.ts -t "didProviderChange|early reflection activation overshoot guard|activate on provider change when threshold messages" --bail=1 --reporter=dot` — 1 file / 20 tests passed / 430 skipped.
- `env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/om-marker.test.ts src/onboarding/__tests__/packs.test.ts src/agents/__tests__/model.test.ts -t "OMMarkerComponent activation rendering|getAvailableModePacks|getAnthropicApiKey|getOpenAIApiKey" --bail=1 --reporter=dot` — 3 files / 17 tests passed / 29 skipped.
- `pnpm --filter ./mastracode exec vitest run src/agents/__tests__/model.test.ts -t "uses direct OpenAI API key provider when stored API key credential exists|uses stored API key credential when not logged in via OAuth" --bail=1 --reporter=dot` — 1 file / 2 tests passed / 34 skipped.
- `pnpm --filter ./packages/core exec vitest run src/agent/message-list/tests/step-start.test.ts src/loop/workflows/agentic-execution/llm-execution-step.test.ts -t "step-start|processor-updated model|configured modelId" --bail=1 --reporter=dot` — 2 files / 9 tests passed / 19 skipped / no type errors.

### PR #15403 / #15423 / #15566 / #15544 feature-map checkpoint

Verified rows 215-218:

- #15403 is a Changesets alpha package-version batch; skipped for feature mapping.
- #15423 adds headless `--output-format text|json|stream-json`. Current `headless.ts` stores `outputFormat` separately from the legacy `format` flag, validates allowed values during parsing, emits text-only final summaries for `text`, final aggregate summaries for `json`, and line-delimited event output for `stream-json`.
- #15566 replaces polynomial-ReDoS-prone regexes with bounded or procedural alternatives across Mastra Code surfaces: ANSI/OSC truncation, tool validation/error parsing, streamed tool rendering, OM thread-tag stripping, and workspace/skill path normalization.
- #15544 is a formatting/lint dependency update; skipped for feature mapping.

Documentation actions:

- Updated `features/headless/prompt-mode.md` for #15423 output-format flags and output contract risk.
- Updated `features/tui/shell-passthrough.md`, `features/tools/coding-tools-permissions.md`, and `features/tools/streaming-tool-arguments.md` for #15566 bounded ANSI/error parsing in shell/tool renderers.
- Updated `features/memory/observational-memory.md` for bounded OM thread-tag stripping.
- Updated `features/integrations/skills-command.md` and `features/tools/workspace-tools.md` for procedural versioned skill/workspace path normalization.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15403 skipped, #15423 done, #15566 done, #15544 skipped, #15448 current.

Focused evidence read: PR metadata for #15403/#15423/#15566/#15544; current `mastracode/src/headless.ts`, `headless.test.ts`, TUI `ansi.ts`, `tool-validation-error.ts`, `tool-execution-enhanced.ts`, memory `message-utils.ts`, core workspace skill source files, and focused test files.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/headless.test.ts -t "output-format" --bail=1 --reporter=dot` — 1 file / 4 tests passed / 40 skipped.
- `pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/message-utils.test.ts --bail=1 --reporter=dot` — 1 file / 6 tests passed.
- `pnpm --filter ./packages/core exec vitest run src/workspace/skills/skill-versioning.test.ts -t "normalizes paths|CompositeVersionedSkillSource" --bail=1 --reporter=dot` — 1 file / 11 tests passed / 45 skipped / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/ansi.test.ts src/tui/components/__tests__/tool-validation-error.test.ts src/tui/components/__tests__/tool-execution-enhanced.test.ts --bail=1 --reporter=dot` — 3 files / 75 tests passed.
- Attempted `pnpm --filter ./packages/core exec vitest run src/utils/semantic-markdown.test.ts --bail=1 --reporter=dot`, but no matching test exists in `packages/core`; semantic-markdown coverage belongs to non-Mastra-Code RAG surfaces and was not included in this checkpoint.

### PR #15448 / #15515 / #15601 / #15606 feature-map checkpoint

Verified rows 219-222:

- #15448 adds the standalone `@mastra/tavily` integration package. Current `integrations/tavily` exposes `createTavilySearchTool()`, `createTavilyExtractTool()`, `createTavilyCrawlTool()`, `createTavilyMapTool()`, and `createTavilyTools()` with shared client creation, env/config API-key resolution, zod schemas, and response normalization. Current Mastra Code `web-search.ts` wraps the package search/extract tools to preserve Mastra Code relevance filtering, markdown formatting, failed-result rendering, and 2k-token output budgets.
- #15515, #15601, and #15606 are Changesets alpha package-version batches; skipped for feature mapping.

Documentation actions:

- Updated `features/tools/web-search-rendering.md` for `@mastra/tavily` package ownership, Mastra Code wrapper delegation, package tests, and the missing wrapper-level formatting/truncation test gap.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15448 done, #15515 skipped, #15601 skipped, #15606 skipped, #15631 current.

Focused evidence read: PR metadata for #15448/#15515/#15601/#15606; current `integrations/tavily/src/{client,search,extract,crawl,map,tools}.ts`, Tavily package tests, `mastracode/src/tools/web-search.ts`, and Mastra Code dynamic-tool tests. No current dedicated Mastra Code wrapper test exists for `createWebSearchTool()` / `createWebExtractTool()` delegation and formatting.

Verification:

- `pnpm --filter ./integrations/tavily test -- --bail=1 --reporter=dot` — 6 files / 31 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/agents/tools.test.ts src/agents/extra-tools.test.ts src/tui/components/__tests__/tool-execution-enhanced.test.ts -t "web search|web-search|web extract|web-extract|Tavily" --bail=1 --reporter=dot` — targeted renderer test passed (1 passed / 83 skipped; dynamic-tool files skipped by the name filter).
- `pnpm --filter ./mastracode exec vitest run src/agents/tools.test.ts src/agents/extra-tools.test.ts --bail=1 --reporter=dot` — 2 files / 23 tests passed.

### PR #15631 / #15605 / #15629 / #15653 feature-map checkpoint

Verified rows 223-226:

- #15631 normalizes Mastra Code TUI status-line model labels: long Fireworks IDs like `fireworks-ai/accounts/fireworks/models/kimi-k2p6` render as `fireworks/kimi-k2.6`, and generic version separators such as `minimax-m2p7` render as `minimax-m2.7` before compact/full-width status-line logic.
- #15605 adds opt-in temporal-gap markers for observational memory. Current Mastra Code dynamic memory enables `temporalMarkers: true`; core Memory serializes the option; `Memory.getInputProcessor()` passes it to `ObservationalMemoryProcessor`; step-0 processing inserts reactive `system-reminder` signals for long pauses; persisted canonical and legacy reminders reload as `TemporalGapComponent` rows anchored before `precedesMessageId` target messages.
- #15629 and #15653 are Changesets alpha package-version batches; skipped for feature mapping.

Documentation actions:

- Updated `features/models/model-auth-and-modes.md` for Fireworks/generic model ID status-line normalization, status-line tests, and display-only drift risk.
- Updated `features/memory/observational-memory.md` for temporal-marker config/state ownership, active insertion, loaded-from-history rendering, key files, tests, missing tests, and timestamp/storage risks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15631 done, #15605 done, #15629 skipped, #15653 skipped, #15678 current.

Focused evidence read: PR metadata for #15631/#15605/#15629/#15653; current `mastracode/src/tui/status-line.ts`; `mastracode/src/tui/__tests__/status-line.test.ts`; `mastracode/src/agents/memory.ts`; `packages/core/src/memory/{memory.ts,types.ts,memory-config.test.ts}`; `packages/memory/src/index.ts`; `packages/memory/src/processors/observational-memory/{processor.ts,temporal-markers.ts,date-utils.ts}`; `packages/memory/src/processors/observational-memory/__tests__/temporal-markers.test.ts`; `mastracode/src/tui/{render-messages.ts,components/temporal-gap.ts,__tests__/render-messages.test.ts}`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/status-line.test.ts -t "rewrites" --bail=1 --reporter=dot` — 1 file / 4 tests passed / 9 skipped.
- `pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/temporal-markers.test.ts --bail=1 --reporter=dot` — 1 file / 5 tests passed.
- `pnpm --filter ./packages/core exec vitest run src/memory/memory-config.test.ts -t "temporalMarkers" --bail=1 --reporter=dot` — 1 file / 1 test passed / 6 skipped / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/render-messages.test.ts -t "temporal-gap" --bail=1 --reporter=dot` — 1 file / 3 tests passed / 21 skipped.

### PR #15678 / #15656 / #15699 / #15749 feature-map checkpoint

Verified rows 227-230:

- #15678 keeps custom slash commands scoped to the active thread. Current `command-dispatch.ts` routes `//name` through `state.customSlashCommands`, keeps built-in `/name` commands preferred over custom collisions, and still lets `//name` force a custom command even when a built-in command has the same name.
- #15656 and #15699 are Changesets alpha package-version batches; skipped for feature mapping.
- #15749 clears per-thread ephemeral state on thread switch/create. Current `event-dispatch.ts`, `/new`, and clone reset paths clear tasks, active plan, sandbox allowed paths, `taskToolInsertIndex`, live task progress, queued/custom command projections, and component caches while preserving non-ephemeral state such as the current model.

Documentation actions:

- Updated `features/chat/queued-followups.md` for active-thread custom command dispatch, state ownership, key files, and command-dispatch tests.
- Updated `features/threads/persistent-conversations.md` and `features/tools/task-tracking.md` for #15749 thread-boundary cleanup, reset paths, and test coverage.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15678 done, #15656 skipped, #15699 skipped, #15749 done, #15730 current.

Focused evidence read: PR metadata for #15678/#15656/#15699/#15749; current `mastracode/src/tui/command-dispatch.ts`, `mastracode/src/tui/__tests__/command-dispatch.test.ts`, `mastracode/src/tui/event-dispatch.ts`, `mastracode/src/tui/__tests__/event-dispatch.test.ts`, `mastracode/src/tui/commands/{new,clone}.ts`, and `mastracode/src/schema.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/command-dispatch.test.ts src/tui/__tests__/event-dispatch.test.ts -t "custom slash|thread_changed|thread_created|taskToolInsertIndex|taskProgress|non-ephemeral" --bail=1 --reporter=dot` — targeted thread lifecycle tests passed (1 file / 5 tests passed / 15 skipped).
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/command-dispatch.test.ts -t "custom slash command|//deploy|//new|built-in command" --bail=1 --reporter=dot` — targeted custom slash-command tests passed (1 file / 7 tests passed / 13 skipped).

### PR #15730 / #15703 / #15642 / #15710 feature-map checkpoint

Verified rows 231-234:

- #15730 adds `ProviderHistoryCompat`, an extensible core prompt/error processor. Current source includes Anthropic invalid tool-call ID sanitization with one retry, Cerebras outbound reasoning stripping, Anthropic foreign-reasoning stripping, provider-prefix detection for resolved/gateway/fallback model shapes, and Mastra Code agent wiring in both input and error processors.
- #15703 lets `/om` observer/reflector pickers accept arbitrary custom model strings. Current source creates synthetic `Use: <id>` model selector entries, persists observer/reflector overrides under the custom OM pack path, and snapshots the other OM role's current model when leaving a built-in pack.
- #15642 adds Mastra Code observability/evals: local DuckDB/cloud exporter setup, `/observability` status/connect/disconnect/local toggles, `/feedback` trace feedback, `buildEvalContext()`, always-on outcome scoring, and sampled efficiency scoring.
- #15710 is a Changesets alpha package-version batch; skipped for feature mapping.

Documentation actions:

- Added `features/models/provider-history-compat.md` for ProviderHistoryCompat rule ownership, prompt/error lifecycle, tests, and provider-history risks.
- Added `features/integrations/observability-and-evals.md` for `/observability`, `/feedback`, eval context/scorers, state ownership, tests, and command/exporter risks.
- Updated `features/models/model-auth-and-modes.md` and `features/memory/observational-memory.md` for custom `/om` model string entries and observer/reflector role override persistence.
- Updated `features/tui/help-and-shortcuts.md` for `/observability` listing and `/feedback` help-surface drift.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15730 done, #15703 done, #15642 done, #15710 skipped, #15759 current.

Focused evidence read: PR metadata for #15730/#15703/#15642/#15710; current `packages/core/src/processors/provider-history-compat.ts`, `provider-history-compat.test.ts`, `mastracode/src/index.ts`, `mastracode/src/__tests__/index.test.ts`, `mastracode/src/tui/{commands/om.ts,components/model-selector.ts,components/om-settings.ts}`, OM/model selector tests, `mastracode/src/evals/{context-builder.ts,scorers/*.ts}`, scorer tests, and TUI `/observability`/`/feedback` command dispatch.

Verification:

- `pnpm --filter ./packages/core exec vitest run src/processors/provider-history-compat.test.ts --bail=1 --reporter=dot` — 1 file / 33 tests passed / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/om-settings.test.ts src/tui/commands/__tests__/om.test.ts --bail=1 --reporter=dot` — 2 files / 8 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/evals/scorers/__tests__/outcome.test.ts src/evals/scorers/__tests__/efficiency.test.ts src/evals/scorers/__tests__/classify-command.test.ts --bail=1 --reporter=dot` — 3 files / 58 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/__tests__/index.test.ts -t "ProviderHistoryCompat" --bail=1 --reporter=dot` — 1 file / 1 test passed / 15 skipped.

### PR #15759 / #15760 / #15695 / #15857 feature-map checkpoint

Verified rows 235-238:

- #15759 updates the OpenAI built-in pack/prompt alignment. Current source uses `openai/gpt-5.5` for OpenAI build/plan, `openai/gpt-5.4-mini` for fast/OM, keeps `PROVIDER_DEFAULT_MODELS['openai-codex']` aligned to `gpt-5.5`, and includes exact-ID prompt sections for `openai/gpt-5.4` and `openai/gpt-5.5`.
- #15760 adds `StreamErrorRetryProcessor`, a core error processor with retryable OpenAI Responses stream-error matching, provider `isRetryable` cause-chain handling, custom matchers, and a `maxRetries` guard. Mastra Code wires it before `PrefillErrorHandler` and `ProviderHistoryCompat`.
- #15695 adds forked subagents: forked runs clone the parent thread, reuse the parent agent/prompt/tool schema prefix, inherit parent harness toolsets with `subagent` and task tools patched to runtime no-ops, retarget request context to the cloned thread, and hide forked threads from default thread listings.
- #15857 is a Changesets alpha package-version batch; skipped for feature mapping.

Documentation actions:

- Added `features/models/stream-error-retry.md` for stream retry processor state ownership, lifecycle, tests, missing tests, and retry risks.
- Updated `features/models/model-auth-and-modes.md` and `features/chat/prompt-context.md` for GPT-5.5 OpenAI pack defaults and exact-ID model-specific prompt sections.
- Updated `features/subagents/delegation.md` for forked subagent thread cloning, parent toolset inheritance, patched task/subagent tools, tests, and risks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15759 done, #15760 done, #15695 done, #15857 skipped, #15896 current.

Focused evidence read: PR metadata for #15759/#15760/#15695/#15857; current `mastracode/src/onboarding/{packs.ts,__tests__/packs.test.ts}`, `mastracode/src/auth/storage.ts`, `mastracode/src/agents/prompts/{model.ts,__tests__/prompts.test.ts}`, `packages/core/src/processors/{stream-error-retry-processor.ts,stream-error-retry-processor.test.ts}`, `docs/src/content/en/reference/processors/stream-error-retry-processor.mdx`, `mastracode/src/index.ts`, `mastracode/src/__tests__/index.test.ts`, `packages/core/src/harness/{tools.ts,harness.ts,types.ts,HarnessCompat.ts,subagent-tool.test.ts,fork-clone-metadata.test.ts,list-threads-fork-filter.test.ts}`, and Mastra Code subagent render tests.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/onboarding/__tests__/packs.test.ts src/agents/__tests__/prompts.test.ts --bail=1 --reporter=dot` — 2 files / 11 tests passed.
- `pnpm --filter ./packages/core exec vitest run src/processors/stream-error-retry-processor.test.ts --bail=1 --reporter=dot` — 1 file / 11 tests passed / no type errors.
- `pnpm --filter ./packages/core exec vitest run src/harness/subagent-tool.test.ts src/harness/fork-clone-metadata.test.ts src/harness/list-threads-fork-filter.test.ts -t "fork" --bail=1 --reporter=dot` — 3 files / 18 tests passed / 15 skipped / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/__tests__/index.test.ts src/tui/__tests__/render-messages.test.ts -t "stream-error-retry|fork" --bail=1 --reporter=dot` — 1 file passed / 1 skipped; 1 test passed / 39 skipped.

### PR #15896 / #15820 / #15770 / #15909 feature-map checkpoint

Verified rows 239-242:

- #15896 and #15909 are Changesets alpha package-version batches; skipped for feature mapping.
- #15820 adds common local binary availability to the Mastra Code system prompt. Current source detects Python/Node/package-manager/git/search/network/container/compiler binaries via `which`/`where`, caches sync/async detection results, feeds `commonBinaries` from `getDynamicInstructions()`, and renders `Common binaries: name: path` / `name: not found` in the base Environment section.
- #15770 is an AI SDK dependency update touching package metadata and lockfiles; skipped for user-visible feature mapping.

Documentation actions:

- Updated `features/chat/prompt-context.md` for common binary detection, Environment prompt rendering, state ownership, key files, tests, and PATH/cache risks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15896 skipped, #15820 done, #15770 skipped, #15909 skipped, #15928 current.

Focused evidence read: PR metadata for #15896/#15820/#15770/#15909; current `mastracode/src/utils/binaries.ts`, `mastracode/src/agents/instructions.ts`, `mastracode/src/agents/prompts/{base.ts,index.ts}`, `mastracode/src/agents/__tests__/prompts.test.ts`, `mastracode/src/headless.ts`, and `mastracode/src/tools/request-sandbox-access.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/agents/__tests__/prompts.test.ts -t "common binary|model-specific" --bail=1 --reporter=dot` — 1 file / 4 tests passed / 2 skipped.

### PR #15928 / #15924 / #15942 / #15940 feature-map checkpoint

Verified rows 243-246:

- #15928 and #15940 are Changesets alpha package-version batches; skipped for feature mapping.
- #15924 shows changelog summaries in update prompts. Current source fetches `CHANGELOG.md` from unpkg for the latest version, parses the matching version section into up to 20 concise bullet entries, filters dependency-update rows/sub-items, strips markdown links and PR/commit references, and injects the optional `What's new:` block into both startup and manual `/update` prompts.
- #15942 displays submitted user messages before async operations complete. Current source renders an optimistic user message immediately after input/image consumption, before `runUserPromptHook()`, pending-thread creation, and `sendSignal()`; blocked hooks remove the optimistic component, while successful signals remap the component id to the Harness signal id for echo dedupe.

Documentation actions:

- Updated `features/setup/auto-update-prompts.md` for changelog fetch/parse behavior, prompt insertion, tests, missing tests, and parser risks.
- Updated `features/tui/interactive-chat.md` for optimistic user-message rendering/remap/removal around async prompt hooks, thread creation, and signal dispatch.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15928 skipped, #15924 done, #15942 done, #15940 skipped, #15993 current.

Focused evidence read: PR metadata for #15928/#15924/#15942/#15940; current `mastracode/src/utils/update-check.ts`, `mastracode/src/utils/__tests__/update-check.test.ts`, `mastracode/src/tui/commands/update.ts`, `mastracode/src/tui/mastra-tui.ts`, and `mastracode/src/tui/__tests__/mastra-tui-queueing.test.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/utils/__tests__/update-check.test.ts -t "parseChangelog" --bail=1 --reporter=dot` — 1 file / 10 tests passed / 3 skipped.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/mastra-tui-queueing.test.ts -t "optimistic|pending new thread" --bail=1 --reporter=dot` — 1 file / 3 tests passed / 27 skipped.

### PR #15993 / #15979 / #16006 / #16009 feature-map checkpoint

Verified rows 247-250:

- #15993 fixes user-message border alignment when the first line is full width. Current `UserMessageComponent`/`BorderedBox` accounts for border, prompt prefix, indent, and right padding in `maxInnerWidth`, so a first line that fills the width no longer pushes the right border out of alignment.
- #15979 and #16009 are Changesets alpha package-version batches; skipped for feature mapping.
- #16006 supports piped stdin as an initial TUI message. Current startup drains non-TTY stdin through `drainPipedStdin()`, sanitizes ANSI/control characters and carriage-return overwrites, reopens `/dev/tty` for interactive keyboard input, sends the pipe as `MastraTUI` `initialMessage`, and falls back to headless with the predrained prompt if no TTY can be reopened.

Documentation actions:

- Updated `features/tui/interactive-chat.md` for full-width user-message border sizing, piped initial-message startup, state ownership, key files, tests, missing tests, and risks.
- Updated `features/headless/prompt-mode.md` for bare pipe vs `--prompt -` routing, TTY reopen, sanitized stdin utilities, and headless fallback.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #15993 done, #15979 skipped, #16006 done, #16009 skipped, #16011 current.

Focused evidence read: PR metadata for #15993/#15979/#16006/#16009; current `mastracode/src/tui/components/user-message.ts`, `mastracode/src/utils/stdin-pipe.ts`, `mastracode/src/utils/__tests__/stdin-pipe.test.ts`, `mastracode/src/headless.ts`, `mastracode/src/main.ts`, and `mastracode/src/tui/mastra-tui.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/utils/__tests__/stdin-pipe.test.ts --bail=1 --reporter=dot` — 1 file / 21 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/mastra-tui-queueing.test.ts -t "initialMessage|pending new thread|optimistic" --bail=1 --reporter=dot` — 1 file / 3 tests passed / 27 skipped.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/render-messages.test.ts -t "UserMessageComponent|pending|interjection|user message" --bail=1 --reporter=dot` — 1 file / 6 tests passed / 18 skipped.

### PR #16011 / #16016 / #16020 / #15395 feature-map checkpoint

Verified rows 251-254:

- #16011, #16016, and #16020 are Changesets alpha package-version batches; skipped for feature mapping after `gh pr view` confirmed only changelog/package metadata changes under Mastra Code.
- #15395 adds multiline support to `ask_user` question input. Current source uses `MultilineInput` around `@mariozechner/pi-tui` `Editor`, Enter submits, Shift+Enter inserts `\n`, backslash+Enter follows the pi-tui newline convention, Escape cancels, render strips editor border/scroll chrome, and raw text is forwarded while trim is used only for emptiness checks. `handleAskQuestion()` opts `ask_user` inline and dialog free-text prompts into multiline by passing `multiline: true` and `state.ui`; components fall back to single-line `Input` when no TUI is available.

Documentation actions:

- Updated `features/tui/interactive-prompts.md` for multiline `ask_user` behavior, keybindings, streaming activation, state ownership, key files, tests, missing tests, and risks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16011 skipped, #16016 skipped, #16020 skipped, #15395 done, #16023 current.

Focused evidence read: PR metadata for #16011/#16016/#16020/#15395; current `mastracode/src/tui/components/multiline-input.ts`, `ask-question-inline.ts`, `ask-question-dialog.ts`, `handlers/prompts.ts`, `handlers/tool.ts`, `components/__tests__/multiline-input.test.ts`, and `components/__tests__/ask-question-inline-multiline.test.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/multiline-input.test.ts --bail=1 --reporter=dot` — 1 file / 16 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/ask-question-inline-multiline.test.ts --bail=1 --reporter=dot` — 1 file / 6 tests passed.

### PR #16023 / #16022 / #16024 / #16068 feature-map checkpoint

Verified rows 255-258:

- #16023 is formatting-only cleanup for `ask-question-inline-multiline.test.ts`; current source retains the formatted `StubSelectList` constructor and multiline opt-in tests.
- #16022 and #16024 are Changesets alpha package-version batches; skipped for feature mapping after `gh pr view` confirmed changelog/package metadata changes under Mastra Code.
- #16068 reduces noisy skill startup logging. Current source has since removed the old unconditional `Skills loaded from:` startup log entirely; the relevant surviving behavior is that `collectSkillPaths()` still guards directory reads with `existsSync()` before symlink expansion while `buildSkillPaths()` continues returning candidate skill roots for workspace access.

Documentation actions:

- Updated `features/integrations/skills-command.md` for quiet skill startup behavior, existing-dir symlink scanning, key files, and test coverage.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16023 done, #16022 skipped, #16024 skipped, #16068 done, #16094 current.

Focused evidence read: PR metadata for #16023/#16022/#16024/#16068; current `mastracode/src/tui/components/__tests__/ask-question-inline-multiline.test.ts`, `mastracode/src/agents/workspace.ts`, and `mastracode/src/agents/__tests__/build-skill-paths.test.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/ask-question-inline-multiline.test.ts --bail=1 --reporter=dot` — 1 file / 6 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/agents/__tests__/build-skill-paths.test.ts --bail=1 --reporter=dot` — 1 file / 9 tests passed.

### PR #16094 / #16135 / #16028 / #16182 feature-map checkpoint

Verified rows 259-262:

- #16094 adds default temp scratch paths to the dynamic workspace. Current `DEFAULT_ALLOWED_PATHS` resolves and de-duplicates `os.tmpdir()` and `/tmp`, then `getDynamicWorkspace()` inserts them between skill paths and per-thread `sandboxAllowedPaths`; reused workspaces receive the same updated allowlist through `existing.filesystem.setAllowedPaths()`.
- #16135 normalizes storage settings connection prompt key handling. Current `StorageBackendSubmenu.handleInput()` accepts `matchesKey(data, 'enter')`/`matchesKey(data, 'escape')` plus raw `\r`/`\n` and `\x1b`/`\x1b\x1b` fallbacks before delegating to `MaskedInput`.
- #16028 and #16182 are Changesets alpha package-version batches; skipped for feature mapping after `gh pr view` confirmed changelog/package metadata changes under Mastra Code.

Documentation actions:

- Updated `features/tools/workspace-tools.md` for default temp allowed paths and missing direct test coverage.
- Updated `features/settings/storage-backend.md` for normalized storage connection prompt Enter/Escape behavior.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16094 done, #16135 done, #16028 skipped, #16182 skipped, #16192 current.

Focused evidence read: PR metadata for #16094/#16135/#16028/#16182; current `mastracode/src/agents/workspace.ts`, `mastracode/src/tui/components/settings.ts`, and feature-adjacent tests.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/agents/__tests__/build-skill-paths.test.ts --bail=1 --reporter=dot` — 1 file / 9 tests passed.
- `pnpm --filter ./mastracode check` — passed.

### PR #16192 / #16250 / #16176 / #13891 feature-map checkpoint

Verified rows 263-266:

- #16192 is a Changesets alpha package-version batch; skipped for feature mapping after `gh pr view` confirmed changelog/package metadata changes under Mastra Code.
- #16250 is a README/docs-only update. It improved Mastra Code README and docs/reference copy without adding runtime behavior to map beyond the existing documentation/Harness/OM cards.
- #16176 adds the provider-boundary `processLLMRequest` hook. Current core resolves a separate LLM request input-processor list, converts `MessageList` to `LanguageModelV2Prompt`, runs `ProcessorRunner.runProcessLLMRequest()` immediately before the provider call, keeps prompt rewrites transient, forwards retry/request context, and allows the first processor-supplied cached response to short-circuit the model call.
- #13891 allows external `createMastraCode()` consumers to override the Harness memory instance/factory. Current `MastraCodeConfig.memory` replaces the default `getDynamicMemory(storage, vectorStore)` path, primarily for custom providers whose models Mastra Code's built-in resolver cannot resolve.

Documentation actions:

- Updated `features/models/provider-history-compat.md` for #16176 provider-boundary prompt rewriting, ProcessorRunner/LLM execution wiring, tests, and risks.
- Updated `features/integrations/harness-api.md` for #13891 memory override ownership, key files, missing tests, and docs-related #16250 attribution.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16192 skipped, #16250 done, #16176 done, #13891 done, #16274 current.

Focused evidence read: PR metadata for #16192/#16250/#16176/#13891; current `packages/core/src/processors/index.ts`, `packages/core/src/processors/runner.ts`, `packages/core/src/processors/provider-history-compat.ts`, `packages/core/src/processors/provider-history-compat.test.ts`, `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`, `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.test.ts`, `mastracode/src/index.ts`, and `mastracode/src/__tests__/index.test.ts`.

Verification:

- `pnpm --filter ./packages/core exec vitest run src/processors/provider-history-compat.test.ts --bail=1 --reporter=dot` — 1 file / 33 tests passed / no type errors.
- `pnpm --filter ./packages/core exec vitest run src/loop/workflows/agentic-execution/llm-execution-step.test.ts -t "processLLMRequest" --bail=1 --reporter=dot` — 1 file / 3 tests passed / 15 skipped / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/__tests__/index.test.ts -t "memory|ProviderHistoryCompat|processor" --bail=1 --reporter=dot` — 1 file / 3 tests passed / 13 skipped.
- `pnpm --filter ./packages/core check` — passed.

### PR #16274 / #16196 / #16126 / #16294 feature-map checkpoint

Verified rows 267-270:

- #16274 standardizes setup/config UI as modal overlays. Current source has shared `showModalOverlay()` / `modalOverlayOptions()` in `tui/overlay.ts`, `askModalQuestion()` in `tui/modal-question.ts`, startup `/setup` onboarding and nested model selectors opened through modal overlays, and config commands (`/models`, `/sandbox`, `/api-keys`, `/subagents`, `/browser`, `/memory-gateway`, `/observability`, `/custom-providers`, login/MCP/goal helpers) routed through modal question/overlay helpers. `theme.ts` maps `toolPendingBg` and `toolSuccessBg` to neutral surface colors.
- #16196 is a Changesets alpha package-version batch; skipped for feature mapping after PR metadata confirmed package/changelog-only changes under Mastra Code.
- #16126 is an AI SDK dependency update batch; skipped for feature mapping after PR metadata confirmed dependency-only changes.
- #16294 fixes OpenAI Codex OAuth callback port selection. Current `auth/providers/openai-codex.ts` tries port 1455 first, then 1457, warns when both are unavailable, uses the selected `redirectUri` in the authorization URL and token exchange, and exports `__testing` helpers. Current tests cover default/fallback port selection, no arbitrary scan, redirect URI, originator, scope, account ID extraction, refresh, and device OAuth.

Documentation actions:

- Created `features/tui/configuration-overlays.md` for modal overlay ownership, entrypoints, tests, and risks.
- Updated `features/settings/onboarding-and-global-settings.md` for #16274 setup/config modal behavior.
- Updated `features/tui/interactive-prompts.md` for shared modal question helper and overlay tests.
- Updated `features/models/model-auth-and-modes.md` for #16294 OpenAI Codex OAuth callback port fallback.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16274 done, #16196 skipped, #16126 skipped, #16294 done, #16065 current.

Focused evidence read: PR metadata for #16274/#16196/#16126/#16294; current `mastracode/src/tui/overlay.ts`, `modal-question.ts`, `mastra-tui.ts`, `onboarding/onboarding-inline.ts`, config command files, `theme.ts`, `tui/__tests__/overlay.test.ts`, `auth/providers/openai-codex.ts`, and `auth/providers/openai-codex.test.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/overlay.test.ts src/tui/__tests__/mastra-tui-quiet-mode.test.ts --bail=1 --reporter=dot` — 2 files / 7 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/auth/providers/openai-codex.test.ts --bail=1 --reporter=dot` — 1 file / 19 tests passed.

### PR #16065 / #16295 / #16322 / #16320 / #16275 / #16326 feature-map checkpoint

Verified rows 271-276:

- #16065 adds persistent `/goal` mode. Current source has `GoalManager` persisted in thread metadata, `/goal` and `/judge` command flows, judge-agent structured decisions (`done`/`continue`/`waiting`), active-duration tracking, input locking during judge evaluation, queued-action precedence before automatic continuation, and plan-mode return after approved-goal completion.
- #16295 and #16320 are Changesets alpha package-version batches; skipped for feature mapping after PR metadata confirmed package/changelog-only changes under Mastra Code.
- #16322 preserves goal command and user-choice text. Current command dispatch keeps raw multiline `/goal` objectives as one argument, supports `/goal/<custom>` and `/goal/<skill>` routes only when goal-enabled, keeps `ask_user` prompts user-controlled while a goal is active, and resolves editor autocomplete before Enter/Ctrl+F submission without stripping slash prefixes.
- #16275 adds `/om` caveman observations controls with thread-state restoration/seeding. Current source mirrors `cavemanObservations` and `observeAttachments` between harness state and thread metadata on startup/thread changes, persists caveman changes through `/om`, and keeps the base prompt warning that caveman memories are storage-only.
- #16326 replaces `js-tiktoken` with `tokenx` in Mastra Code token-estimation helpers and core `TokenLimiterProcessor`, accepting heuristic token estimation in exchange for removing bundled BPE rank tables.

Documentation actions:

- Created `features/goals/persistent-goals.md` for `/goal` state ownership, judge loop, command routing, tests, and risks.
- Updated `features/goals/plan-approval.md` for the `Use as /goal` handoff.
- Updated `features/memory/observational-memory.md` for #16275 caveman/attachment thread-state persistence.
- Updated `features/chat/prompt-context.md`, `features/tools/coding-tools-permissions.md`, and `features/tools/web-search-rendering.md` for goal prompt context and `tokenx` token-budget ownership.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16065 done, #16295 skipped, #16322 done, #16320 skipped, #16275 done, #16326 done, #16351 current.

Focused evidence read: PR metadata for #16065/#16295/#16322/#16320/#16275/#16326; current `mastracode/src/tui/goal-manager.ts`, `commands/goal.ts`, `goal-input-lock.ts`, `handlers/agent-lifecycle.ts`, `command-dispatch.ts`, `components/custom-editor.ts`, `components/judge-display.ts`, `status-line.ts`, goal/queueing/dispatch/setup/prompt tests, `mastracode/src/agents/thread-caveman-state.ts`, `commands/om.ts`, `components/om-settings.ts`, `agents/memory.ts`, `thread-caveman-state.test.ts`, `mastracode/src/utils/token-estimator.ts`, and `packages/core/src/processors/processors/token-limiter.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/goal-manager.test.ts src/tui/commands/__tests__/goal.test.ts --bail=1 --reporter=dot` — failed on the existing `GoalManager > uses stream with structured output and judge memory thread parent-goalId` assertion before docs-only changes touched no runtime/test files; targeted follow-up coverage below passed.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/goal-manager.test.ts -t "preserves turn|does not keep|updates judge|no judge model|judge resume|budget exhaustion|readonly|reports judge activity|provider compatibility|waiting on the user|paused before|cleared before|different goal" --bail=1 --reporter=dot` — 1 file / 14 tests passed / 10 skipped.
- `pnpm --filter ./mastracode exec vitest run src/tui/commands/__tests__/goal.test.ts --bail=1 --reporter=dot` — 1 file / 15 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/command-dispatch.test.ts src/tui/__tests__/setup-keyboard-shortcuts.test.ts src/tui/handlers/__tests__/prompts.test.ts src/tui/__tests__/parallel-interactive-prompts.test.ts src/tui/components/__tests__/custom-editor.test.ts -t "goal|Goal|ask_user|plan approval|slash autocomplete|Ctrl\\+F" --bail=1 --reporter=dot` — 5 files / 25 tests passed / 35 skipped.
- `pnpm --filter ./mastracode exec vitest run src/agents/thread-caveman-state.test.ts src/__tests__/index.test.ts -t "caveman|observeAttachments" --bail=1 --reporter=dot` — 2 files / 9 tests passed / 16 skipped.
- `pnpm --filter ./packages/core exec vitest run src/processors/processors/token-limiter.test.ts --bail=1 --reporter=dot` — 1 file / 39 tests passed / no type errors.

### PR #16351 / #16254 / #16332 / #16340 feature-map checkpoint

Verified rows 277-280:

- #16351 is a dependency dedupe/cleanup batch; skipped for feature mapping after PR metadata confirmed external dependency cleanup only.
- #16254 adds stable task patch tools. Current core Harness `tools.ts` owns deterministic `assignTaskIds()`, `task_write` full replacement semantics, `task_update` single-task mutation by ID, `task_complete`, `task_check` summaries, one-`in_progress` enforcement, and forked-subagent task-tool stubs. Mastra Code TUI projects task mutations through `task_updated`, `TaskProgressComponent`, `pendingTaskToolIds`, and completed/cleared inline summaries.
- #16332 consolidates Mastra Code gateway sync behind core `GatewayRegistry`. Current Mastra Code startup/heartbeat delegates sync to the core registry, which handles dynamic loading, global cache writes, corruption validation/deletion, static fallback, refresh timestamps, and silent network/cache failures.
- #16340 fixes plan approval started as `/goal`: `handlePlanApproval().onGoal` resolves `respondToPlanApproval()` first, then calls `ctx.startGoal()` so the suspended plan tool settles before the canonical goal reminder starts a fresh Build-mode run. Core Harness tests cover resolver-before-abort and stale abort-state clearing.

Documentation actions:

- Updated `features/tools/task-tracking.md` for stable task IDs and patch/check tools.
- Updated `features/models/model-auth-and-modes.md` for core-owned gateway sync and corrupt-cache fallback.
- Updated `features/goals/persistent-goals.md` and `features/goals/plan-approval.md` for resolver-first approved-plan goal handoff.
- Updated `features/integrations/harness-api.md` for plan approval resolver ordering and stale abort/tracing state.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16351 skipped, #16254 done, #16332 done, #16340 done, #16129 current.

Focused evidence read: PR metadata for #16351/#16254/#16332/#16340; current `packages/core/src/harness/tools.ts`, `task-tools.test.ts`, `mastracode/src/tui/event-dispatch.ts`, `handlers/tool.ts`, `components/task-progress.ts`, `mastracode/src/utils/gateway-sync.ts`, `gateway-sync.test.ts`, `packages/core/src/llm/model/provider-registry.ts`, `provider-registry.test.ts`, `mastracode/src/tui/handlers/prompts.ts`, `handlers/__tests__/prompts.test.ts`, `commands/goal.ts`, `commands/__tests__/goal.test.ts`, `packages/core/src/harness/harness.ts`, `mode-model-persistence.test.ts`, and `tracing-propagation.test.ts`.

Verification:

- `pnpm exec vitest run src/harness/task-tools.test.ts --bail=1 --reporter=dot` from `packages/core` — 1 file / 30 tests passed / no type errors.
- `pnpm --filter ./packages/core exec vitest run src/llm/model/provider-registry.test.ts --bail=1 --reporter=dot` — 1 file / 27 tests passed / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/utils/__tests__/gateway-sync.test.ts src/tui/handlers/__tests__/prompts.test.ts src/HarnessCompat.test.ts --bail=1 --reporter=dot` — 3 files / 18 tests passed.

### PR #16129 / #16398 / #16223 / #16409 feature-map checkpoint

Verified rows 281-284:

- #16129 adds GitHub Copilot OAuth/provider support. Current source has a GitHub device-code login flow, optional enterprise-domain handling, Copilot token refresh, OpenAI-compatible Copilot provider routing for `github-copilot/<model>`, Copilot request headers/URL rewriting, a provider-filtered Copilot pack, and live `/models` catalog discovery with TTL/fallback/inflight caching.
- #16398 is an AI SDK dependency-update batch; skipped for feature mapping after PR metadata confirmed package-only dependency changes.
- #16223 renames the recommended observability exporters to `MastraPlatformExporter` and `MastraStorageExporter` while keeping deprecated `CloudExporter`/`DefaultExporter` compatibility exports. Current Mastra Code observability setup uses explicit storage + platform exporters.
- #16409 is a Changesets alpha package-version batch; skipped for feature mapping after PR metadata confirmed package/changelog-only changes.

Documentation actions:

- Updated `features/models/model-auth-and-modes.md` for GitHub Copilot OAuth, provider routing, model pack defaults, live catalog, tests, and risks.
- Updated `features/integrations/observability-and-evals.md` for the storage/platform exporter rename and deprecated compatibility names.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16129 done, #16398 skipped, #16223 done, #16409 skipped, #16231 current.

Focused evidence read: PR metadata for #16129/#16398/#16223/#16409; current `mastracode/src/auth/providers/github-copilot.ts`, `mastracode/src/providers/github-copilot.ts`, `mastracode/src/agents/model.ts`, `mastracode/src/onboarding/packs.ts`, `mastracode/src/index.ts`, Copilot auth/provider/catalog tests, `observability/mastra/src/exporters/mastra-platform.ts`, `mastra-storage.ts`, `default.ts`, `cloud.ts`, `default.ts` observability setup, and storage/platform exporter tests.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/auth/providers/__tests__/github-copilot.test.ts src/providers/__tests__/github-copilot-catalog.test.ts src/providers/__tests__/oauth-fetches.test.ts src/onboarding/__tests__/packs.test.ts --bail=1 --reporter=dot` — 4 files / 48 tests passed.
- `pnpm exec vitest run src/exporters/mastra-storage.test.ts src/exporters/mastra-platform.test.ts --bail=1 --reporter=dot` from `observability/mastra` — 2 files / 119 tests passed.

### PR #16231 / #16338 / #16458 / #16501 feature-map checkpoint

Verified rows 285-288:

- #16231 sends Mastra Code active-run follow-ups through Agent signals. Current source owns signal creation/conversion in `packages/core/src/agent/signals.ts`, Harness `sendSignal()`/`sendMessage()`/follow-up queueing in `harness.ts`, Mastra Code pending interjection projection and echo dedupe in `mastra-tui.ts`/`render-messages.ts`, and fallback transient queues for Ctrl+F, slash commands, and attachment paths that cannot signal directly.
- #16338 enables signal follow-up chat in Playground and Agent Builder. Current React `useChat()` subscribes to thread streams, sends threaded messages with `ifIdle.streamOptions`, falls back when thread signals are disabled/unsupported, and Playground projects `pendingSignals` through `ThreadRuntimeState` into composer previews and send/cancel button state.
- #16458 and #16501 are Changesets alpha package-version batches; skipped for feature mapping after PR metadata confirmed package/changelog-only changes.

Documentation actions:

- Created `features/chat/agent-signals.md` for Agent signal conversion, Harness follow-up queueing, React/Playground subscription behavior, tests, and risks.
- Updated `features/chat/queued-followups.md` for #16231 Enter-as-signal versus Ctrl+F/attachment queue fallback.
- Updated `features/tui/interactive-chat.md`, `features/integrations/harness-api.md`, and `features/goals/persistent-goals.md` for pending signal projection, Harness signal APIs, and goal continuation signals.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16231 done, #16338 done, #16458 skipped, #16501 skipped, #16511 current.

Focused evidence read: PR metadata for #16231/#16338/#16458/#16501; current `packages/core/src/agent/signals.ts`, `packages/core/src/harness/harness.ts`, signal/history tests, `client-sdks/react/src/agent/hooks.ts`, `hooks.test.ts`, `mastracode/src/tui/mastra-tui.ts`, `state.ts`, `handlers/agent-lifecycle.ts`, `render-messages.ts`, Mastra Code queue/render tests, `packages/playground/src/services/mastra-runtime-provider.tsx`, `lib/ai-ui/thread-runtime-state.ts`, `lib/ai-ui/thread.tsx`, and Agent Builder stream-chat provider tests.

Verification:

- `pnpm --filter ./packages/core exec vitest run src/agent/__tests__/agent-signals.test.ts src/harness/signal-messages.test.ts src/harness/signal-history.test.ts --bail=1 --reporter=dot` — 3 files / 102 tests passed / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/mastra-tui-queueing.test.ts src/tui/__tests__/render-messages.test.ts -t "signal|Signal|active-run|echo" --bail=1 --reporter=dot` — 2 files / 19 tests passed / 35 skipped.
- `pnpm --filter ./client-sdks/react exec vitest run src/agent/hooks.test.ts -t "thread signals|sendMessage|subscription|clientTools|unsupported|tool approval" --bail=1 --reporter=dot` — 1 file / 20 tests passed. Initial run failed to resolve `@mastra/client-js`; `pnpm --filter @mastra/client-js build:lib` regenerated package dist.
- `pnpm --filter ./packages/playground exec vitest run src/services/__tests__/mastra-runtime-provider.test.tsx src/domains/agent-builder/contexts/__tests__/stream-chat-provider.test.tsx -t "thread signals|enableThreadSignals" --bail=1 --reporter=dot` — 2 files / 4 tests passed / 9 skipped. Initial runs failed to resolve workspace package dist; `@mastra/react build:js` and `@mastra/playground-ui build` emitted JS but hit existing type/declaration errors before focused tests passed.

### PR #16511 / #16513 / #16516 / #16521 feature-map checkpoint

Verified rows 289-292:

- #16511 and #16516 are Changesets alpha package-version batches; skipped for feature mapping after PR metadata confirmed package/changelog-only changes.
- #16513 speeds up Mastra Code startup and local LibSQL behavior. Current source starts gateway sync in the background after stored API keys load, keeps heartbeat gateway sync for refresh, applies Mastra Code local LibSQL PRAGMA overrides (`cache_size=-128000`, `mmap_size=536870912`), applies safe local LibSQL PRAGMAs before schema init, caches/coalesces local file DB init while keeping in-memory DB reinit, adds message indexes for thread history reads, and caches table-column metadata for migration-compatible writes.
- #16521 fixes regular plan approval by resolving `respondToPlanApproval()` first, then sending a single structured `system-reminder` through `harness.sendSignal()` to start Build-mode execution. The handler no longer uses legacy XML reminders, `addUserMessage`, or `fireMessage`, preventing duplicate rendering and hangs on the dying Plan-mode run.

Documentation actions:

- Created `features/setup/startup-performance.md` for the startup/LibSQL optimization layer, state ownership, tests, and risks.
- Updated `features/settings/storage-backend.md` for #16513 local LibSQL PRAGMAs/init/indexes.
- Updated `features/goals/plan-approval.md`, `features/integrations/harness-api.md`, and `features/chat/agent-signals.md` for #16521 structured regular approval handoff.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16511 skipped, #16513 done, #16516 skipped, #16521 done, #16548 current.

Focused evidence read: PR metadata for #16511/#16513/#16516/#16521; current `mastracode/src/index.ts`, `main.ts`, `utils/storage-factory.ts`, `tui/handlers/prompts.ts`, `tui/handlers/__tests__/prompts.test.ts`, `stores/libsql/src/storage/index.ts`, `stores/libsql/src/storage/db/index.ts`, `stores/libsql/src/storage/local-performance.test.ts`, `stores/libsql/src/storage/db/migration-columns.test.ts`, and `mastracode/src/__tests__/index.test.ts`.

Verification:

- `pnpm --filter ./stores/libsql exec vitest run src/storage/local-performance.test.ts src/storage/db/migration-columns.test.ts --bail=1 --reporter=dot` — 2 files / 9 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/__tests__/index.test.ts src/tui/handlers/__tests__/prompts.test.ts --bail=1 --reporter=dot` — 2 files / 22 tests passed.
- `pnpm --filter ./packages/core exec vitest run src/harness/signal-history.test.ts --bail=1 --reporter=dot` — 1 file / 3 tests passed / no type errors.

### PR #16548 / #16559 / #16611 / #16624 feature-map checkpoint

Verified rows 293-296:

- #16548 adds OpenAI Codex browser/device OAuth selection and protected HTTP MCP OAuth config support. Current source advertises `OPENAI_CODEX_AUTH_MODES` (`browser`, `device`) through `openaiCodexOAuthProvider.authModes`, prompts through `LoginModeSelectorComponent`, honors explicit `callbacks.authMode` over `MASTRACODE_OPENAI_CODEX_AUTH_MODE`, implements the official Codex device user-code flow, extracts/preserves ChatGPT `accountId` from token claims during login/refresh, and injects Codex runtime headers (`Authorization`, `ChatGPT-Account-ID`, `originator`, `User-Agent`) through `buildOpenAICodexOAuthFetch()`. The MCP path validates HTTP OAuth config (`redirectUrl`, scopes, optional client credentials), builds `MCPOAuthClientProvider` for protected HTTP servers, and stores OAuth tokens in per-project/server `mcp-oauth/<fingerprint>.json` files.
- #16559, #16611, and #16624 are Changesets alpha package-version batches; skipped for feature mapping after PR metadata confirmed package/changelog-only changes.

Documentation actions:

- Updated `features/models/model-auth-and-modes.md` for #16548 Codex auth modes, device flow, account-id storage/refresh, Codex headers, model routing, login-mode selector, and test coverage.
- Updated `features/integrations/mcp-server-configuration.md` for #16548 protected HTTP MCP OAuth config, validation, `MCPOAuthClientProvider`, and per-project/server token storage.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16548 done, #16559/#16611/#16624 skipped, #16654 current.

Focused evidence read: PR metadata for #16548/#16559/#16611/#16624; current `mastracode/src/auth/providers/openai-codex.ts`, `mastracode/src/providers/openai-codex.ts`, `mastracode/src/auth/types.ts`, `mastracode/src/auth/storage.ts`, `mastracode/src/tui/commands/login.ts`, `mastracode/src/tui/components/login-mode-selector.ts`, `mastracode/src/agents/model.ts`, `mastracode/src/mcp/config.ts`, `mastracode/src/mcp/manager.ts`, `mastracode/src/mcp/types.ts`, `docs/src/mastra-code/configuration.mdx`, and focused tests under `mastracode/src/auth/providers/openai-codex.test.ts`, `providers/__tests__/openai-codex-fetch.test.ts`, `mcp/__tests__/config.test.ts`, `mcp/__tests__/manager.test.ts`, and `agents/__tests__/model.test.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/auth/providers/openai-codex.test.ts src/providers/__tests__/openai-codex-fetch.test.ts --bail=1 --reporter=dot` — 2 files / 20 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/mcp/__tests__/config.test.ts src/mcp/__tests__/manager.test.ts --bail=1 --reporter=dot` — 2 files / 66 tests passed.
- `env -u OPENAI_API_KEY -u MASTRA_OPENAI_API_KEY pnpm --filter ./mastracode exec vitest run src/agents/__tests__/model.test.ts -t "Codex|openai|mastra-prefixed" --bail=1 --reporter=dot` — 1 file / 15 tests passed / 21 skipped. Initial run without unsetting OpenAI env failed one expected router-path assertion because local `OPENAI_API_KEY` made the resolver take the direct OpenAI path.

### PR #16654 / #16657 / #16618 / #16622 feature-map checkpoint

Verified rows 297-300:

- #16654 improves goal judge UX. Current source supports a `waiting` judge decision for explicit user checkpoints, retries once when the judge stream returns no structured output, records `lastPauseWasJudgeFailure` so `/goal resume` retriggers judgment instead of sending a stale main-agent continuation, guards no-assistant-response judge resumes, streams readonly judge-tool activity into `JudgeDisplayComponent`, and switches the status line to a blue `judge` badge/model while evaluation is active.
- #16657 is a Changesets alpha package-version batch; skipped for feature mapping after PR metadata confirmed package/changelog-only changes.
- #16618 adds explicit `/skill/<name> [args]` activation. Current source dispatches `skill/` commands, resolves workspace skills eagerly, hides `user-invocable: false` skills from `/skills` and direct activation, wraps formatted skill instructions in `<skill name="...">`, escapes embedded `</skill>` boundaries, supports pending-new-thread activation, and keeps goal-skill aliases via `/goal/<skill>`.
- #16622 narrows `AgentSignalContents` to string or text/file parts and fixes multimodal signal handling. Current source persists canonical text/file DB parts, preserves providerOptions, inlines XML markers into text parts (or prepends a marker for file-only signals), decodes legacy `metadata.signal.contents` shapes from prior string/parts/CoreUserMessage rows, updates server schemas, and keeps React `useChat` signal content normalization aligned.

Documentation actions:

- Updated `features/goals/persistent-goals.md` for #16654 judge waiting/retry/resume behavior, active judge badge/model display, and updated test/risk notes.
- Updated `features/integrations/skills-command.md` for #16618 explicit skill activation, `user-invocable` filtering, `<skill>` wrapping, and tests.
- Updated `features/chat/agent-signals.md` for #16622 narrowed multimodal signal contents, legacy DB rehydration, providerOptions preservation, and server/React surfaces.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16654 done, #16657 skipped, #16618 done, #16622 done, #16690 current.

Focused evidence read: PR metadata for #16654/#16657/#16618/#16622; current `mastracode/src/tui/goal-manager.ts`, `components/judge-display.ts`, `commands/goal.ts`, `handlers/agent-lifecycle.ts`, `handlers/prompts.ts`, `status-line.ts`, `command-dispatch.ts`, `commands/skills.ts`, `commands/skill-filters.ts`, `state.ts`; current `packages/core/src/agent/signals.ts`, `client-sdks/react/src/agent/hooks.ts`, `client-sdks/react/src/agent/signal-data.ts`, `packages/server/src/server/schemas/agents.ts`, and focused tests under `goal-manager.test.ts`, `commands/__tests__/goal.test.ts`, `commands/__tests__/skills.test.ts`, and `packages/core/src/agent/__tests__/agent-signals.test.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/goal-manager.test.ts src/tui/commands/__tests__/goal.test.ts src/tui/components/__tests__/judge-display.test.ts src/tui/__tests__/status-line.test.ts -t "pauses|retry|resume|waiting|activity|interrupted|status|JudgeDisplay|status line|does not auto-continue|tells the judge|clears stale|budget exhaustion|readonly" --bail=1 --reporter=dot` — 4 files / 25 tests passed / 31 skipped. A broader first run of the same goal files hit the known fragile `uses stream with structured output and judge memory thread parent-goalId` Zod matcher assertion.
- `pnpm --filter ./mastracode exec vitest run src/tui/commands/__tests__/skills.test.ts src/tui/__tests__/command-dispatch.test.ts src/tui/components/__tests__/help-overlay.test.ts --bail=1 --reporter=dot` — 3 files / 33 tests passed.
- `pnpm --filter ./packages/core exec vitest run src/agent/__tests__/agent-signals.test.ts src/harness/signal-history.test.ts src/harness/signal-messages.test.ts --bail=1 --reporter=dot` — 3 files / 102 tests passed / no type errors.

### PR #16690 / #16691 / #16676 / #16663 feature-map checkpoint

Verified rows 301-304:

- #16690 tracks active goal pursuit time. Current source starts/stops `GoalManager` active timers around turn/judge work, accumulates `activeDurationMs`, stops timers on done/waiting/pause/abort/error, and renders elapsed active time in the status line without counting idle waiting time.
- #16691 makes Mastra Code workspace commands inherit the parent environment. `buildSandboxEnv()` now spreads `process.env` before terminal/CI overrides, and workspace tracing keeps env-shaped fields and secret-pattern keys redacted.
- #16676 returns approved-plan goals to Plan mode after completion. `handlePlanApproval().onGoal` records `planStartedGoalId`; lifecycle checks the completed goal id and switches back to Plan mode, while manual goals/clear reset the marker.
- #16663 adds provider-aware OM idle activation plumbing. Current source forwards actor model context into OM activation, resolves `activateAfterIdle: 'auto'` from provider/model/cache-retention heuristics, skips duplicate local OM processing for Mastra Gateway models, emits TTL/provider-change activation metadata, and renders a TUI idle counter/activation markers.

Documentation actions:

- Updated `features/goals/persistent-goals.md` for #16690 active pursuit timer and #16676 approved-goal return-to-plan behavior.
- Updated `features/tools/workspace-tools.md` for #16691 parent env inheritance and trace redaction coverage.
- Updated `features/memory/observational-memory.md` for #16663 actor-model idle activation, Gateway skip, TUI idle counter, activation TTL details, and tests.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16690 done, #16691 done, #16676 done, #16663 done, #16665 current.

Focused evidence read: PR metadata for #16690/#16691/#16676/#16663; current `mastracode/src/tui/goal-manager.ts`, `tui/handlers/agent-lifecycle.ts`, `tui/commands/goal.ts`, `tui/handlers/prompts.ts`, `tui/status-line.ts`, `agents/workspace.ts`, `packages/core/src/workspace/tools/tracing.ts`, `agents/memory.ts`, `tui/mastra-tui.ts`, `tui/components/idle-counter.ts`, `tui/components/om-marker.ts`, `tui/handlers/om.ts`, `packages/memory/src/processors/observational-memory/activation-ttl.ts`, `processor.ts`, `observational-memory.ts`, and focused tests under `agent-lifecycle-goal-timer.test.ts`, `workspace-env.test.ts`, `tracing.test.ts`, `activation-ttl.test.ts`, `observational-memory-api.test.ts`, and `memory-gateway-duck-typing.test.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/agent-lifecycle-goal-timer.test.ts src/tui/__tests__/mastra-tui-queueing.test.ts src/tui/handlers/__tests__/prompts.test.ts src/tui/__tests__/status-line.test.ts --bail=1 --reporter=dot` — 4 files / 51 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/agents/__tests__/workspace-env.test.ts --bail=1 --reporter=dot` — 1 file / 1 test passed.
- `pnpm --filter ./packages/core exec vitest run src/workspace/tools/__tests__/tracing.test.ts --bail=1 --reporter=dot` — 1 file / 6 tests passed / no type errors.
- `pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/activation-ttl.test.ts src/processors/observational-memory/__tests__/observational-memory-api.test.ts -t "activateAfterIdle|resolveActivationTTL|auto ttl" --bail=1 --reporter=dot` — 2 files / 16 tests passed / 135 skipped.
- `pnpm --filter ./packages/core exec vitest run src/agent/__tests__/memory-gateway-duck-typing.test.ts --bail=1 --reporter=dot` — 1 file / 1 test passed / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/tui/handlers/__tests__/om.test.ts --bail=1 --reporter=dot` — 1 file / 3 tests passed.

### PR #16665 / #16682 / #16667 / #15173 feature-map checkpoint

Verified rows 305-308:

- #16665 routes Agent thread stream subscriptions through PubSub. Current source scopes `AgentThreadStreamRuntime` state by `WeakMap<PubSub, ...>`, publishes run registration/stream-part/completion/suspend/abort/signal-enqueued events with `sourceId`, creates remote subscriber streams for non-local runs, lets Agents inherit PubSub from Mastra/Harness unless they have an own PubSub, and lets Mastra Code disable file thread locks only when cross-process PubSub is explicitly enabled.
- #16682 adds the `/om` Observe Attachments Auto/On/Off setting. Current source persists `models.omObserveAttachments`, seeds `state.observeAttachments`, restores thread metadata via `thread-caveman-state.ts`, threads the setting into `getDynamicMemory()` and its cache key, and exposes a three-way OM settings selector.
- #16667 is a Changesets alpha package-version batch; skipped for feature mapping after PR metadata confirmed package/changelog-only changes.
- #15173 adds Mastra Code product analytics. Current source creates `MastraCodeAnalytics` as PostHog-backed or no-op depending on `MASTRA_TELEMETRY_DISABLED`, captures session/prompt/thread/model/command/interactive-prompt events, and wraps capture/shutdown in try/catch.

Documentation actions:

- Updated `features/integrations/harness-api.md` and `features/chat/agent-signals.md` for #16665 PubSub-scoped Agent thread runtime state, cross-runtime broadcasting, Harness propagation, and tests.
- Updated `features/memory/observational-memory.md` and `features/settings/onboarding-and-global-settings.md` for #16682 observe-attachments persistence, thread restore/seed, and OM settings UI.
- Updated `features/integrations/observability-and-evals.md` for #15173 product analytics opt-out/no-op behavior and event surfaces.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16665 done, #16682 done, #16667 skipped, #15173 done, #16771 current.

Focused evidence read: PR metadata for #16665/#16682/#16667/#15173; current `packages/core/src/agent/thread-stream-runtime.ts`, `agent.ts`, `packages/core/src/harness/harness.ts`, `mastracode/src/index.ts`, `mastracode/src/tui/commands/om.ts`, `components/om-settings.ts`, `mastracode/src/agents/thread-caveman-state.ts`, `mastracode/src/agents/memory.ts`, `mastracode/src/analytics.ts`, `main.ts`, `tui/command-dispatch.ts`, `tui/event-dispatch.ts`, and focused tests under `packages/core/src/agent/__tests__/agent-signals.test.ts`, `mastracode/src/__tests__/index.test.ts`, `mastracode/src/tui/commands/__tests__/om.test.ts`, `mastracode/src/analytics.test.ts`, and command/thread analytics tests.

Verification:

- `pnpm --filter ./packages/core exec vitest run src/agent/__tests__/agent-signals.test.ts -t "PubSub|pubsub|runtime instances|injected PubSub|Mastra-based" --bail=1 --reporter=dot` — 1 file / 5 tests passed / 68 skipped / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/__tests__/index.test.ts src/agents/thread-caveman-state.test.ts -t "PubSub|observeAttachments" --bail=1 --reporter=dot` — 2 files / 8 tests passed / 17 skipped.
- `pnpm --filter ./mastracode exec vitest run src/__tests__/analytics.test.ts src/tui/__tests__/command-dispatch.test.ts src/tui/commands/__tests__/threads.test.ts -t "analytics|tracks" --bail=1 --reporter=dot` — 2 files passed + 1 skipped / 6 tests passed / 23 skipped.

### PR #16771 / #16797 / #16669 / #16804 feature-map checkpoint

Verified rows 309-312:

- #16771 adds quiet mode's current compact renderer. Current source persists `quietMode` and `quietModeMaxToolPreviewLines`, shows the one-time quiet-mode preference prompt, applies quiet display to live/rendered tools, groups compact tool runs, caps preview lines, and renders task progress as item-aware quiet summaries.
- #16669 coordinates Mastra Code signals over Unix socket PubSub. Current source resolves `signalsPubSub` from explicit PubSub or `unixSocketPubSub`, maps thread topics to `/tmp/mc/<resourceId>/<threadId>.sock`, uses core `UnixSocketPubSub` broker election/backpressure/recovery, and disables file thread locks only when cross-process PubSub is active.
- #16797 and #16804 are Changesets alpha package-version batches; skipped for feature mapping after PR metadata confirmed package/changelog-only changes.

Documentation actions:

- Updated `features/tui/quiet-mode.md` for #16771 quiet-mode rollout, preview caps, compact tool grouping, task summaries, key files, tests, and risks.
- Updated `features/chat/agent-signals.md` and `features/integrations/harness-api.md` for #16669 Unix socket PubSub transport, per-thread socket routing, cross-process signal delivery, and tests.
- Updated `features/settings/onboarding-and-global-settings.md` for #16771 quiet preferences and #16669 signal transport flags.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16771 done, #16797 skipped, #16669 done, #16804 skipped, #16807 current.

Focused evidence read: PR metadata for #16771/#16797/#16669/#16804; current `mastracode/src/tui/mastra-tui.ts`, `tui/components/settings.ts`, `tui/components/task-progress.ts`, `tui/components/tool-execution-enhanced.ts`, `tui/chat-boundary-reconciliation.ts`, `tui/chat-spacing.ts`, `tui/handlers/tool.ts`, `tui/render-messages.ts`, `mastracode/src/onboarding/settings.ts`, `mastracode/src/index.ts`, `mastracode/src/utils/signals-pubsub.ts`, `packages/core/src/events/unix-socket-pubsub.ts`, and focused tests under `mastracode/src/tui/__tests__/mastra-tui-quiet-mode.test.ts`, `components/__tests__/task-progress.test.ts`, `components/__tests__/tool-execution-enhanced.test.ts`, `packages/core/src/events/__tests__/unix-socket-pubsub.test.ts`, `mastracode/src/utils/__tests__/signals-pubsub.test.ts`, and `packages/core/src/agent/__tests__/agent-signals.test.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/mastra-tui-quiet-mode.test.ts src/tui/components/__tests__/task-progress.test.ts src/tui/components/__tests__/tool-execution-enhanced.test.ts -t "quiet|Quiet|compact" --bail=1 --reporter=dot` — 3 files / 61 tests passed / 10 skipped.
- `pnpm --filter ./mastracode exec vitest run src/utils/__tests__/signals-pubsub.test.ts src/__tests__/index.test.ts -t "SignalsPubSub|unixSocketPubSub|crossProcessPubSub|explicit pubsub|threadLock" --bail=1 --reporter=dot` — 1 file passed + 1 skipped / 4 tests passed / 16 skipped.
- `pnpm --filter ./packages/core exec vitest run src/events/unix-socket-pubsub.test.ts --bail=1 --reporter=dot` — 1 file / 8 tests passed / no type errors. An earlier attempt used the wrong `src/events/__tests__/unix-socket-pubsub.test.ts` path and failed with "No test files found" before this corrected run.
- `pnpm --filter ./packages/core exec vitest run src/agent/__tests__/agent-signals.test.ts -t "UnixSocketPubSub|remote subscriber without same-runtime" --bail=1 --reporter=dot` — 1 file / 1 test passed / 72 skipped / no type errors.

### PR #16807 / #16809 / #16835 / #16839 feature-map checkpoint

Verified rows 313-316:

- #16807 polishes quiet mode follow-ups. Current source handles compact continuation labels, path-prefix trimming, preview rails/caps, quiet code highlighting, same-tool grouped spacing, loaded-history parity, and quiet shell/compact spacing distinctions.
- #16835 improves TUI render scheduling, especially thread-selector preview loads. Current source batches initial preview candidates, delays follow-up loads, persists preview seed maps, and uses `previewLoadVersion` to prevent stale async results from overwriting newer selector state.
- #16839 improves quiet-mode task/list contrast and alignment. Current source adds near-black-aware glyph contrast helpers, preserves subdued glyphs on black terminals, applies stronger contrast on brighter backgrounds, and covers hue-preserving contrast adaptation.
- #16809 is a Changesets alpha package-version batch; skipped for feature mapping after PR metadata confirmed package/changelog-only changes.

Documentation actions:

- Updated `features/tui/quiet-mode.md` for #16807/#16839 continuation labels, path-prefix trimming, preview rails, grouped spacing, glyph contrast, key files, and tests.
- Updated `features/tui/terminal-theme.md` for #16839 near-black-aware glyph contrast helpers and terminal-output contrast state.
- Updated `features/threads/persistent-conversations.md` for #16835 thread-selector preview scheduling, stale-version guards, delayed preview batches, and tests.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16807 done, #16809 skipped, #16835 done, #16839 done, #16849 current.

Focused evidence read: PR metadata for #16807/#16809/#16835/#16839; current `mastracode/src/tui/components/tool-execution-enhanced.ts`, `task-progress.ts`, `chat-spacing.ts`, `chat-boundary-reconciliation.ts`, `theme.ts`, `thread-selector.ts`, `mastracode/src/tui/mastra-tui.ts`, `handlers/tool.ts`, `handlers/message.ts`, `render-messages.ts`, and focused tests under `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts`, `task-progress.test.ts`, `chat-boundary-spacer.test.ts`, `thread-selector.test.ts`, `mastracode/src/tui/__tests__/theme-contrast.test.ts`, and `render-messages.test.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/tool-execution-enhanced.test.ts src/tui/components/__tests__/task-progress.test.ts --bail=1 --reporter=dot` — 2 files / 68 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/chat-boundary-spacer.test.ts src/tui/components/__tests__/thread-selector.test.ts --bail=1 --reporter=dot` — 2 files / 16 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/theme-contrast.test.ts src/tui/__tests__/render-messages.test.ts --bail=1 --reporter=dot` — 2 files / 62 tests passed.
- Note: an initial `pnpm --filter ./mastracode test -- --run ...` attempt incorrectly ran the broad Mastra Code suite and hit unrelated known/baseline failures (`goal-manager` Zod matcher, GitHub command completion expecting no `sync`, `save-plan` temp cleanup). The focused `exec vitest run` commands above passed.

### PR #16849 / #16843 / #16831 / #16920 feature-map checkpoint

Verified rows 317-320:

- #16849 fits compact terminal output by visible width. Current source uses `truncateAnsi()` / `fitVisibleText()` for quiet compact previews, preserves ANSI SGR and OSC 8 hyperlink sequences, and applies visible-width fitting in compact tool summaries/previews.
- #16843 tightens goal judge and task patch behavior. Current source uses `JUDGE_MAX_STEPS=50`, a retry prompt for missing structured output, `lastPauseWasJudgeFailure` resume retriggering, and `demoteExtraInProgress()` for patch-tool updates while preserving full-list validation.
- #16920 converts update prompts to inline chat questions. Current source uses `AskQuestionInlineComponent`, clears dismissed-version state on manual `/update`, keeps passive 45-minute update banners, and shares registry/changelog/package-manager helpers.
- #16831 is a Changesets alpha package-version batch; skipped for feature mapping after PR metadata confirmed package/changelog-only changes.

Documentation actions:

- Updated `features/tui/quiet-mode.md` for #16849 visible-width/ANSI-safe compact terminal output.
- Updated `features/goals/persistent-goals.md` for #16843 judge max-step/retry/resume behavior.
- Updated `features/tools/task-tracking.md` for #16843 patch-tool auto-demotion of extra active tasks.
- Updated `features/setup/auto-update-prompts.md` for #16920 inline update prompts and passive update rechecks.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16849 done, #16843 done, #16831 skipped, #16920 done, #16923 current.

Focused evidence read: PR metadata for #16849/#16843/#16831/#16920; current `mastracode/src/tui/ansi.ts`, `mastracode/src/tui/components/tool-execution-enhanced.ts`, `mastracode/src/tui/goal-manager.ts`, `mastracode/src/tui/commands/goal.ts`, `packages/core/src/harness/tools.ts`, `mastracode/src/utils/update-check.ts`, `mastracode/src/tui/commands/update.ts`, and `mastracode/src/tui/mastra-tui.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/ansi.test.ts src/tui/components/__tests__/tool-execution-enhanced.test.ts --bail=1 --reporter=dot` — 2 files / 70 tests passed.
- `pnpm --filter ./packages/core exec vitest run src/harness/task-tools.test.ts --bail=1 --reporter=dot` — 1 file / 30 tests passed / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/goal-manager.test.ts -t "judge resume|no structured|stale judge|budget exhaustion|waiting" --bail=1 --reporter=dot` — 1 file / 7 tests passed / 17 skipped.
- `pnpm --filter ./mastracode exec vitest run src/tui/commands/__tests__/goal.test.ts src/utils/__tests__/update-check.test.ts --bail=1 --reporter=dot` — 2 files / 28 tests passed.
- Note: an initial broader goal/update command hit the known `goal-manager.test.ts` Zod structured-output matcher object-diff failure at line 338; the narrower changed-path goal tests above passed.

### PR #16923 / #16790 / #16939 / #16922 feature-map checkpoint

Verified rows 321-324:

- #16923 adds signal delivery attributes for active/idle context. Current source resolves `ifActive` / `ifIdle` attributes before persistence so Mastra Code can render active interjections as `delivery="while-active"` and idle messages as `delivery="message"` after reload.
- #16790 runs slash/custom slash commands immediately during active runs through the pending signal path, blocks that path during goal-judge evaluation, creates pending threads before custom slash sends, and makes git branch refresh async.
- #16939 isolates Unix socket PubSub by thread. Current source routes `agent.thread-stream.<resourceId\0threadId>` topics to `/tmp/mc/<resourceId>/<threadId>.sock`, coalesces socket creation, and avoids cross-thread serialization/OOM risk.
- #16922 generates provider attachment capability files and wires `modelSupportsAttachments()` into OM attachment Auto mode so text-only observer models get placeholder text while multimodal observer models receive attachments.

Documentation actions:

- Updated `features/chat/agent-signals.md` for #16923 delivery attributes and #16939 per-thread socket isolation.
- Updated `features/chat/queued-followups.md`, `features/tui/interactive-chat.md`, and `features/git/branch-context.md` for #16790 active-run slash-command dispatch and async branch refresh.
- Updated `features/memory/observational-memory.md` and `features/models/model-auth-and-modes.md` for #16922 provider capability files and OM attachment Auto mode.
- Updated `features/integrations/harness-api.md`, `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16923 done, #16790 done, #16939 done, #16922 done, #16951 current.

Focused evidence read: PR metadata for #16923/#16790/#16939/#16922; current `packages/core/src/agent/signals.ts`, `thread-stream-runtime.ts`, `packages/core/src/events/unix-socket-pubsub.ts`, `mastracode/src/utils/signals-pubsub.ts`, `mastracode/src/tui/mastra-tui.ts`, `command-dispatch.ts`, `commands/skills.ts`, `git/branch-context` paths, `packages/core/src/llm/model/provider-registry.ts`, generated capability JSON files, and `packages/memory/src/processors/observational-memory/observational-memory.ts` tests.

Verification:

- `pnpm --filter ./packages/core exec vitest run src/agent/__tests__/agent-signals.test.ts -t "delivery option attributes" --bail=1 --reporter=dot` — 1 file / 6 tests passed / 67 skipped / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/command-dispatch.test.ts --bail=1 --reporter=dot` — 1 file / 20 tests passed.
- `pnpm --filter ./packages/core exec vitest run src/llm/model/provider-registry.test.ts -t "modelSupportsAttachments" --bail=1 --reporter=dot` — 1 file / 1 test passed / 26 skipped / no type errors.
- `pnpm --filter ./packages/memory exec vitest run src/processors/observational-memory/__tests__/observational-memory.test.ts -t "auto mode" --bail=1 --reporter=dot` — 1 file / 3 tests passed / 447 skipped.
- `pnpm --filter ./packages/core exec vitest run src/events/__tests__/per-thread-pubsub-multiprocess.test.ts --bail=1 --reporter=dot` — 1 file / 6 tests passed / no type errors.

### PR #16951 / #16987 / #17008 / #17005 feature-map checkpoint

Verified rows 325-328:

- #16951 replaces remaining sync prompt/runtime probes with async alternatives. Current source uses cached/coalesced async common-binary detection and async git branch refresh in dynamic instruction assembly so TUI rendering/input are not blocked by `which`/git probes.
- #16987 combines idle-timeout and activation information into a single OM activation marker line. Current marker rendering adds inline `(5m idle timeout)` style suffixes for TTL-triggered activation while keeping provider-change and reflection activation output distinct.
- #17008 fixes mode-switch delay, active-run mode switching, Ctrl+F duplicate handling, and modal/input responsiveness. Current keyboard handling blocks Shift+Tab while an agent or plan approval is active and keeps explicit follow-up queue/render paths responsive.
- #17005 wraps long `ask_user` option labels in streaming, answered, and cancelled inline prompt states so option boxes stay within terminal width.

Documentation actions:

- Updated `features/chat/prompt-context.md` and `features/setup/startup-performance.md` for #16951 async dynamic prompt probes.
- Updated `features/memory/observational-memory.md` for #16987 inline idle-timeout activation marker rendering.
- Updated `features/tui/interactive-chat.md` for #17008 active-run mode-switch/Ctrl+F guards.
- Updated `features/tui/interactive-prompts.md` for #17005 long option-label wrapping.
- Updated `features/README.md`, `_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #16951 done, #16987 done, #17008 done, #17005 done, #13751 current.

Focused evidence read: PR metadata for #16951/#16987/#17008/#17005; current `mastracode/src/agents/instructions.ts`, `mastracode/src/utils/binaries.ts`, `mastracode/src/tui/components/om-marker.ts`, `mastracode/src/tui/setup.ts`, `mastracode/src/tui/mastra-tui.ts`, `mastracode/src/tui/components/ask-question-inline.ts`, and related focused tests.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/agents/__tests__/prompts.test.ts src/tui/components/__tests__/om-marker.test.ts src/tui/components/__tests__/ask-question-inline-long-labels.test.ts --bail=1 --reporter=dot` — 3 files / 14 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/setup-keyboard-shortcuts.test.ts -t "queues follow-ups|blocks Ctrl\\+F|toggles system reminder expansion" --bail=1 --reporter=dot` — 1 file / 3 tests passed / 7 skipped.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/mastra-tui-queueing.test.ts -t "running|slash commands|goal judge|mode switch" --bail=1 --reporter=dot` — 1 file / 8 tests passed / 22 skipped.

### PR #13751 / #17032 / #16984 / #17070 feature-map checkpoint

Verified rows 329-332:

- #13751 adds `createMastraCode({ configDir })`. Current source validates safe single-directory names, stores the value in `MastraCodeState.configDir`, and passes it through storage, MCP, hooks, slash commands, static instructions, resource IDs, workspace skill paths, and dynamic prompt/workspace state.
- #17032 preserves unresolved slash-command `@` references instead of replacing them with file-read errors, which keeps command text such as `@me` or GitHub search qualifiers intact; the bundled `pr-triage` command was updated around explicit user-selected PR queues.
- #16984 suppresses gateway refresh/fetch errors and stops noisy retry behavior. Current source silently falls back to bundled registry/capability data, coalesces syncs, validates cache files before atomic copies, and deletes corrupt JSON cache files quietly.
- #17070 fixes legacy subagent results and Mastra Code type checks. Current source keeps legacy generate results to text plus optional usage, preserves raw subagent tool result access where expected, and tightens `MastraCodeConfig`/HarnessCompat typing around `MastraCodeState`.

Documentation actions:

- Created `features/settings/custom-config-directory.md` for #13751.
- Updated `features/settings/onboarding-and-global-settings.md`, `features/integrations/mcp-server-configuration.md`, `features/integrations/lifecycle-hooks.md`, `features/integrations/skills-command.md`, `features/chat/prompt-context.md`, and `features/chat/queued-followups.md` for configDir path ownership.
- Updated `features/chat/queued-followups.md` for #17032 unresolved `@` preservation and pr-triage behavior.
- Updated `features/models/model-auth-and-modes.md` for #16984 gateway refresh fallback behavior.
- Updated `features/integrations/harness-api.md` and `features/subagents/delegation.md` for #17070 typed config and legacy subagent result behavior.
- Updated `features/README.md`, `features/_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #13751 done, #17032 done, #16984 done, #17070 done, #17054 current.

Focused evidence read: PR metadata for #13751/#17032/#16984/#17070; current `mastracode/src/constants.ts`, `index.ts`, `schema.ts`, `agents/workspace.ts`, `agents/prompts/agent-instructions.ts`, `utils/slash-command-loader.ts`, `mcp/config.ts`, `hooks/config.ts`, `utils/slash-command-processor.ts`, `.mastracode/commands/pr-triage.md`, `mastracode/src/utils/gateway-sync.ts`, `packages/core/src/llm/model/provider-registry.ts`, `packages/core/src/agent/agent.ts`, and focused tests.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/__tests__/validate-config-dir-name.test.ts src/agents/__tests__/build-skill-paths.test.ts --bail=1 --reporter=dot` — 2 files / 22 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/utils/__tests__/slash-command-processor.test.ts --bail=1 --reporter=dot` — 1 file / 2 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/utils/__tests__/gateway-sync.test.ts --bail=1 --reporter=dot` — 1 file / 7 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/HarnessCompat.test.ts -t "subagent|Subagent|subagent model" --bail=1 --reporter=dot` — 1 file / 1 test passed / 4 skipped.
- `pnpm --filter ./packages/core exec vitest run --project unit:packages/core src/agent/__tests__/supervisor-integration.test.ts -t "hide sub-agent tool results" --bail=1 --reporter=dot` — 1 file / 1 test passed / 41 skipped / no type errors.

### PR #17054 / #16872 / #17071 / #17108 feature-map checkpoint

Verified rows 333-336:

- #17054 adds a visible-width-safe `WrappingSelectList` picker for long `ask_user` option labels. Current source renders long labels with `↳` continuation rows, keeps arrow navigation item-based instead of row-based, and supports fixed-option multi-select checkbox rendering.
- #16872 is a Changesets alpha package-version batch; skipped for feature mapping after PR metadata confirmed package/changelog-only changes.
- #17071 decodes Kitty CSI-u and xterm modifyOtherKeys printable key sequences for tool approval shortcuts. Current source normalizes raw bytes, unmodified printable CSI-u values, and Shift+letter forms before mapping `y`/`n`/`a`/`Y` to approval actions while rejecting Ctrl/Alt variants.
- #17108 is a Changesets alpha package-version batch; skipped for feature mapping after PR metadata confirmed package/changelog-only changes.

Documentation actions:

- Updated `features/tui/interactive-prompts.md` for #17054 wrapping picker labels, `↳` continuation rows, item-based navigation, and checkbox multi-select support.
- Updated `features/tools/coding-tools-permissions.md` for #17071 terminal-protocol-aware approval shortcut decoding.
- Updated `features/README.md`, `features/_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #17054 done, #16872 skipped, #17071 done, #17108 skipped, #17114 current.

Focused evidence read: PR metadata for #17054/#16872/#17071/#17108; current `mastracode/src/tui/components/wrapping-select-list.ts`, `ask-question-inline.ts`, `ask-question-dialog.ts`, `tui/key-input.ts`, `components/tool-approval-dialog.ts`, and focused tests.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/wrapping-select-list.test.ts src/tui/__tests__/key-input.test.ts src/tui/components/__tests__/tool-approval-dialog.test.ts --bail=1 --reporter=dot` — 3 files / 86 tests passed.

### PR #17114 / #17138 / #17220 / #17333 feature-map checkpoint

Verified rows 337-340:

- #17114 is a Changesets alpha package-version batch; skipped for feature mapping after current commit stats confirmed only `.changeset/pre.json`, `mastracode/CHANGELOG.md`, and `mastracode/package.json` under Mastra Code scope.
- #17138 is a Changesets alpha package-version batch; skipped for feature mapping after current commit stats confirmed only `.changeset/pre.json`, `mastracode/CHANGELOG.md`, and `mastracode/package.json` under Mastra Code scope.
- #17220 adds missing lint-staged configs, including `mastracode/lint-staged.config.js`; skipped as build/developer workflow config rather than user-visible Mastra Code behavior.
- #17333 wraps long slash/custom/skill autocomplete descriptions in the editor picker. Current source overrides pi-tui autocomplete list creation in `CustomEditor` with `WrappingAutocompleteList`, wraps descriptions under the description column when width permits, keeps narrow terminals single-column, and keeps arrow navigation item-based.

Documentation actions:

- Updated `features/chat/queued-followups.md` for #17333 wrapped autocomplete descriptions and current tests/risks.
- Updated `features/README.md`, `features/_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #17114 skipped, #17138 skipped, #17220 skipped, #17333 done, #17334 current.

Focused evidence read: PR metadata and commit stats for #17114/#17138/#17220/#17333; current `mastracode/lint-staged.config.js`, `mastracode/src/tui/components/wrapping-autocomplete-list.ts`, `custom-editor.ts`, `wrapping-autocomplete-list.test.ts`, and `custom-editor.test.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/wrapping-autocomplete-list.test.ts --bail=1 --reporter=dot` — 1 file / 11 tests passed.

### PR #17334 / #17283 / #17174 / #17365 feature-map checkpoint

Verified rows 341-344:

- #17334 renders `ask_user` `multi_select` prompts as true checkbox multi-select pickers. Current source threads `selectionMode` through `dispatchEvent()` and `handleAskQuestion()`, wires `onSubmitMulti` in inline/dialog prompt components, omits `Custom response...` for multi-select, and responds to Harness with an array of selected option labels.
- #17283 adds configurable TUI shell passthrough for local `!` commands. Current source persists `settings.shellPassthrough`, supports `MASTRACODE_SHELL` / `MASTRACODE_SHELL_MODE`, resolves POSIX/cmd/PowerShell families, uses default shell fallback with warnings for invalid config, and preserves explicit shell invocation through `createShellPassthroughSubprocess()`.
- #17174 and #17365 are Changesets alpha package-version batches; skipped for feature mapping after commit stats confirmed only `.changeset/pre.json`, `mastracode/CHANGELOG.md`, and `mastracode/package.json` under Mastra Code scope.

Documentation actions:

- Updated `features/tui/interactive-prompts.md` for #17334 multi-select picker behavior, array answers, hints, tests, and state ownership.
- Updated `features/tui/shell-passthrough.md` and `features/settings/onboarding-and-global-settings.md` for #17283 persisted/env shell passthrough config.
- Updated `features/README.md`, `features/_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #17334 done, #17283 done, #17174 skipped, #17365 skipped, #17276 current.

Focused evidence read: PR metadata and commit stats for #17334/#17283/#17174/#17365; current `ask-question-inline.ts`, `ask-question-dialog.ts`, `handlers/prompts.ts`, `event-dispatch.ts`, `ask-question-inline-multi-select.test.ts`, `handlers/__tests__/prompts.test.ts`, `shell-config.ts`, `shell-runner.ts`, `shell-result.ts`, `shell.ts`, `settings.ts`, `shell-config.test.ts`, `shell.test.ts`, and `shell-result.test.ts`.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/ask-question-inline-multi-select.test.ts src/tui/handlers/__tests__/prompts.test.ts src/tui/__tests__/shell-config.test.ts src/tui/__tests__/shell.test.ts src/tui/__tests__/shell-result.test.ts --bail=1 --reporter=dot` — 5 files / 43 tests passed.

### PR #17276 / #17387 / #17431 / #17421 feature-map checkpoint

Verified rows 345-348:

- #17276 adds scoped Harness v1 owner IDs. Current source stores `ownerId` on `Harness`, `Session`, and `SessionRecord`; fresh thread sessions get deterministic `sess-${sha256(resourceId\0threadId).slice(0,32)}` IDs; Mastra Code derives a stable `mastracode-${sha256(hostname\0projectPath).slice(0,32)}` owner ID and pre-fills Harness v1 sessions from existing memory threads.
- #17387 is a Changesets alpha package-version batch; skipped for feature mapping after current commit stats confirmed only Mastra Code changelog/package changes.
- #17431 truncates bordered TUI content that still exceeds the available inner width on narrow terminals. Current source uses `truncateToWidth()` in `UserMessageComponent`, `AskQuestionBorderedBox`, and `PlanContentBox` after measuring with `visibleWidth()`.
- #17421 is a Changesets alpha package-version batch; skipped for feature mapping after current commit stats confirmed only Mastra Code changelog/package changes.

Documentation actions:

- Updated `features/integrations/harness-api.md` and `features/threads/persistent-conversations.md` for #17276 owner-scoped Harness v1 session records and deterministic session IDs.
- Updated `features/tui/interactive-chat.md`, `features/tui/interactive-prompts.md`, and `features/goals/plan-approval.md` for #17431 narrow-terminal truncation behavior and test gaps.
- Updated `features/README.md`, `features/_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #17276 done, #17387 skipped, #17431 done, #17421 skipped, #17452 current.

Focused evidence read: PR metadata and commit stats for #17276/#17387/#17431/#17421; current `packages/core/src/harness/v1/harness.ts`, `session.ts`, `harness.types.ts`, storage `domains/harness/*`, `mastracode/src/index.ts`, `HarnessCompat.ts`, `tui/commands/threads.ts`, `user-message.ts`, `ask-question-inline.ts`, `plan-approval-inline.ts`, and focused tests.

Verification:

- `pnpm --filter ./packages/core exec vitest run src/harness/v1/session.test.ts src/storage/domains/harness/inmemory.test.ts --bail=1 --reporter=dot` — 2 files / 24 tests passed / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/ask-question-inline-long-labels.test.ts src/tui/components/__tests__/plan-approval-inline.test.ts --bail=1 --reporter=dot` — 2 files / 8 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/__tests__/index.test.ts -t 'owner|session|Harness|thread' --bail=1 --reporter=dot` — 1 file / 6 tests passed / 10 skipped.

### PR #17452 / #17476 / #17480 / #17240 feature-map checkpoint

Verified rows 349-352:

- #17452 is a Changesets alpha package-version batch; skipped after current commit stats confirmed only `mastracode/CHANGELOG.md` and `mastracode/package.json` changes in Mastra Code scope.
- #17476 is a Changesets alpha package-version batch; skipped after current commit stats confirmed only `mastracode/CHANGELOG.md` and `mastracode/package.json` changes in Mastra Code scope.
- #17480 is a Changesets alpha package-version batch; skipped after current commit stats confirmed only `mastracode/CHANGELOG.md` and `mastracode/package.json` changes in Mastra Code scope.
- #17240 adds processor-driven state signals. Current source exposes `computeStateSignal()`/`sendStateSignal()` types, persists snapshots/deltas through `applyStateSignal()`, tracks dedupe/versioning in thread `metadata.mastra.stateSignals`, makes `BrowserContextProcessor` emit `browser` snapshots/deltas, and renders streamed/loaded `state_signal` and `reactive_signal` parts in Mastra Code TUI.

Documentation actions:

- Created `features/chat/processor-state-signals.md` for #17240.
- Updated `features/chat/agent-signals.md`, `features/integrations/browser-automation.md`, and `features/tui/interactive-chat.md` for state/reactive signal variants, browser state-signal behavior, and TUI rendering.
- Updated `features/README.md`, `features/_pr-queue.md`, `handoff.md`, and this history entry.
- Queue status: #17452 skipped, #17476 skipped, #17480 skipped, #17240 done, #17241 current.

Focused evidence read: PR metadata and commit stats for #17452/#17476/#17480/#17240; current `packages/core/src/agent/state-signals.ts`, `thread-stream-runtime.ts`, `signals.ts`, `processors/index.ts`, `processors/runner.ts`, `browser/processor.ts`, `mastracode/src/tui/components/state-signal.ts`, `reactive-signal.ts`, `handlers/message.ts`, `render-messages.ts`, and focused tests.

Verification:

- `pnpm --filter ./packages/core exec vitest run src/agent/__tests__/agent-signals.test.ts -t 'state signals|state signal|sendStateSignal|processor state signals' --bail=1 --reporter=dot` — 1 file / 1 test passed / 72 skipped / no type errors.
- `pnpm --filter ./packages/core exec vitest run src/browser/processor.test.ts src/processors/runner.test.ts -t 'state signal|computeStateSignal|state signals|BrowserContextProcessor' --bail=1 --reporter=dot` — 2 files / 22 tests passed / 61 skipped / no type errors.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/render-messages.test.ts src/tui/handlers/__tests__/message.test.ts -t 'state signal|reactive signal|reactive signals|GitHub subscribe operation signals' --bail=1 --reporter=dot` — 2 files / 6 tests passed / 34 skipped.

### Rows 353-356 feature-map checkpoint

Processed rows 353-356 in oldest-to-newest order:

- #17241 — notification inbox signals: verified storage records/coalescing, delivery policy/dispatcher/workflow, notification and summary signal creation, `notification_inbox` tool actions, tool guidance, and TUI notification components for streamed/history rendering.
- #17447 — GitHub signal subscriptions: verified `/github` commands, subscribe/unsubscribe/status reactive signals, gitcrawl sync client, repository resolver, polling, PR snapshot cursors/classification, notification production, and experimental signal-setting wiring.
- #17411 — composed Harness v1 session state: verified `HarnessCompat.getState()` / `setState()` composition of legacy state plus active v1 session state/model/mode and thread/session metadata paths.
- #17511 — fallback legacy `switchMode`: verified `HarnessCompat.switchMode()` still updates active v1 sessions when present and falls back to legacy mode switching when no session is active.

Documentation updates:

- Added `features/chat/notification-inbox-signals.md` and `features/git/github-signal-subscriptions.md`.
- Updated README rows for agent signals, notification inbox, GitHub subscriptions, persistent conversations, settings, interactive chat, tools/permissions, and Harness API.
- Updated agent-signals, processor-state-signals, interactive-chat, onboarding/global settings, persistent-conversations, harness-api, and coding-tools-permissions cards.
- Marked `_pr-queue.md` rows 353-356 done and advanced handoff to row 357 #17492.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/github-signals/index.test.ts src/tui/commands/__tests__/github.test.ts src/agents/extra-tools.test.ts --bail=1 --reporter=dot` — 3 files / 68 tests passed.
- `pnpm --filter ./mastracode exec vitest run src/HarnessCompat.test.ts src/__tests__/index.test.ts -t 'state|switchMode|GithubSignals|notification_inbox|notification inbox' --bail=1 --reporter=dot` — 1 file passed / 1 skipped; 5 tests passed / 16 skipped.
- `pnpm --filter ./packages/core exec vitest run src/notifications/notifications.test.ts src/agent/__tests__/agent-signals.test.ts -t 'notification|Notification|sendNotificationSignal' --bail=1 --reporter=dot` — 2 files / 33 tests passed / 62 skipped / no type errors.

### Rows 357-358 feature-map checkpoint

Processed final queued rows 357-358 in oldest-to-newest order:

- #17492 — Changesets alpha package-version batch; skipped after PR/file verification confirmed the Mastra Code scope only changed `mastracode/CHANGELOG.md` and `mastracode/package.json`.
- #17538 — GitHub Signals branch PR auto-subscribe: verified current `handleAgentEnd()` calls `tryAutoSubscribeToBranchPR()` once per thread after a normal agent run completes; the helper gates on `settings.signals.experimentalGithubSignals`, requires an active GitHub Signals processor plus current thread/resource, detects the checked-out branch PR through `gh pr view --json url`, calls `subscribeThreadToPR`, shows a best-effort info message, and swallows detection/subscription failures so agent completion is not disrupted.

Documentation actions:

- Updated `features/git/github-signal-subscriptions.md` with #17538 as a later change, branch PR auto-subscribe behavior, state ownership, key files, test coverage, missing lifecycle guard coverage, and known risks.
- Updated `features/README.md` GitHub Signals row to include #17538.
- Marked `_pr-queue.md` row 357 skipped and row 358 done.
- Updated `handoff.md` to record that current `_pr-queue.md` is exhausted through row 358.

Focused evidence read: `gh pr view` metadata for #17492/#17538; `git show --name-only` for both merge commits; current `mastracode/src/tui/commands/github.ts`, `mastracode/src/tui/handlers/agent-lifecycle.ts`, `mastracode/src/tui/commands/__tests__/github.test.ts`, and existing GitHub Signals feature card.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/commands/__tests__/github.test.ts --bail=1 --reporter=dot` — 1 file / 17 tests passed.
- Queue exhaustion check: `rows=358 first=1 last=358 blank_status=[]`.

### Rebase onto main and baseline check

Rebased `tests/mc` cleanly onto `origin/main` after committing the audit-tests removal planning note. Root Vitest config on main includes `mastracode/vitest.config.ts`, so Mastra Code unit tests are discoverable through the generic `unit:*` CI path, though explicit `build:mastracode` / `test:mastracode` workflow wiring was not found in the inspected workflows.

Local baseline evidence after rebase:

- `pnpm run build:mastracode` initially failed because local install metadata referenced `eslint@10.3.0`; `pnpm install --no-frozen-lockfile --ignore-scripts` refreshed metadata and exposed a one-line committed `pnpm-lock.yaml` mismatch for `agent-sdks/openai` (`eslint` resolution updated to `10.4.1`).
- `pnpm run build:mastracode` passed after the lockfile refresh.
- Unsanitized `pnpm test:mastracode -- --run --reporter=dot` failed in `src/agents/__tests__/model.test.ts` because local provider env leaked into model auth expectations.
- Sanitized run passed: `env -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u ANTHROPIC_API_KEY -u GOOGLE_GENERATIVE_AI_API_KEY -u COHERE_API_KEY pnpm test:mastracode -- --run --reporter=dot` — 107 files / 1202 tests passed.

Implication: workstream 1 is close locally, but env sanitization remains a required baseline rule. Workstream 2 may already have generic CI coverage via root Vitest project discovery, but should be audited explicitly before marking done.

### TUI/AIMock harness discovery

Inspected `/Users/tylerbarnes/code/microsoft/tui-test` and `/Users/tylerbarnes/code/CopilotKit/aimock` for workstream 4.

Findings written to `.plan/mastracode-testing-recovery/tui-aimock-discovery.md` and linked from the recovery README.

Summary:

- `@microsoft/tui-test` is a strong fit for real Mastra Code TUI e2e tests: it drives a real PTY via `node-pty`, observes output through `@xterm/headless`, supports text locators, key/mouse input, cursor/buffer inspection, snapshots, retries, and traces.
- AIMock is a strong fit for deterministic model behavior: `LLMock` can start on a random port, serve fixtures, expose request journals, and match requests by user/system text, tool name, tool-call id, model, turn/sequence index, endpoint, or predicate.
- AIMock can record real interactions: on fixture miss it can proxy to real upstream providers, relay the response, collapse supported streaming responses, save fixtures to disk, and replay later. This should be a local fixture-generation workflow only; CI should use replay-only fixtures.
- AIMock's Mastra docs are useful for capability context but appear stale for current Mastra APIs (`provider: "OPEN_AI"` object-style config), so future MC tests should follow current repo model configuration instead of copying those snippets.

Recommended next spike: one tiny Mastra Code TUI e2e test that starts AIMock, creates a hermetic MC config dir pointed at AIMock, spawns MC under `tui-test`, submits one prompt, asserts the mocked assistant response appears, and verifies AIMock saw exactly one model request.

### TUI/AIMock runner spike

Proved the agreed runner shape with a small planning spike at `.plan/mastracode-testing-recovery/spikes/mc-e2e/`.

The spike uses one shared scenario (`basic-chat`) and two entry points:

- Vitest headless execution generated from scenario discovery.
- Custom CLI observe execution using the same scenario.

Verified commands:

```sh
pnpm exec tsx .plan/mastracode-testing-recovery/spikes/mc-e2e/cli.ts --list
pnpm exec tsx .plan/mastracode-testing-recovery/spikes/mc-e2e/cli.ts basic-chat --observe
pnpm exec vitest run --config .plan/mastracode-testing-recovery/spikes/mc-e2e/vitest.config.ts --reporter=dot --bail=1
```

Result: observe mode mirrored the toy TUI transcript live; Vitest ran the same scenario headlessly with 1 passing test. Recorded the agent-terminal limitation: background command tools expose output and kill controls but not direct stdin injection, so future live-control support should be explicit in the runner via foreground stdin, socket, named pipe, or scenario-step commands.

### Control-file observe mode proof

Extended the `mc-e2e` planning spike with a `--control-file <path>` mode. The harness creates/truncates the file, polls appended content, and forwards each appended line to the child process stdin.

Verified agent-control workflow:

```sh
rm -f /tmp/mc-e2e-control.txt
pnpm exec tsx .plan/mastracode-testing-recovery/spikes/mc-e2e/cli.ts controlled-chat --observe --control-file /tmp/mc-e2e-control.txt
# in another command once the file exists:
printf 'hello\n' >> /tmp/mc-e2e-control.txt
```

In this environment, the observe runner was started with `execute_command(..., background: true)`, then a separate `execute_command` appended `hello` to the control file. The runner printed `[mc-e2e-control] hello`, forwarded it to the toy TUI stdin, observed `assistant: Hi from AIMock`, and passed. This confirms a regular file inbox is enough for agents to control background observe sessions without direct background-process stdin support.

### Recording-driven scenario proof

Extended the `mc-e2e` spike with `--record <path>` and `record-to-scenario.ts`.

Verified flow:

```sh
rm -f /tmp/mc-e2e-control.txt /tmp/mc-e2e-recording.json
pnpm exec tsx .plan/mastracode-testing-recovery/spikes/mc-e2e/cli.ts controlled-chat --observe --control-file /tmp/mc-e2e-control.txt --record /tmp/mc-e2e-recording.json
# from a second command after the control file exists:
printf 'hello\n' >> /tmp/mc-e2e-control.txt
pnpm exec tsx .plan/mastracode-testing-recovery/spikes/mc-e2e/record-to-scenario.ts /tmp/mc-e2e-recording.json .plan/mastracode-testing-recovery/spikes/mc-e2e/generated/recorded-controlled.scenario.ts
pnpm exec tsx .plan/mastracode-testing-recovery/spikes/mc-e2e/run-scenario-file.ts .plan/mastracode-testing-recovery/spikes/mc-e2e/generated/recorded-controlled.scenario.ts --observe
```

Result: the observe run wrote `/tmp/mc-e2e-recording.json` with forwarded inputs, transcript, and AIMock request count. The converter generated `generated/recorded-controlled.scenario.ts`, and `run-scenario-file.ts` ran the generated scenario successfully. This proves an agent can drive an observed terminal via control-file writes, record the transcript, and turn that recording into a draft scenario/test skeleton.

## 2026-06-06 — Test recovery goal command

Added a dedicated goal-mode command for autonomous Mastra Code test recovery:

```text
/goal/recover-mc-tests
```

The command owns the full unfinished test-recovery queue rather than accepting a specific feature. It initializes/updates `.plan/mastracode-testing-recovery/test-recovery-tracker.md` from the feature-map index, picks the next unfinished feature by risk/coverage priority, extracts contracts, adds missing tests, performs verification gates and realistic break-validation where practical, updates evidence, and commits clean grouped chunks on the current branch.

Updated recovery docs to use the current same-branch workflow: no separate feature branches/worktrees by default; commit by feature area or by large test group.

Follow-up: clarified the goal workflow so feature/test-group verification gates are judged by the goal judge during autonomous runs, not by the user. The user should only be asked for final approval after the full unfinished queue is exhausted or remaining rows are explicitly deferred. Also clarified that grouped commits should be pushed after committing so recovery progress is available remotely.

### Test recovery: Git branch context footer shield

Initialized `.plan/mastracode-testing-recovery/test-recovery-tracker.md` from the feature-map index with 56 unfinished rows. Selected `Git: Branch context and status` first because it is High risk, Missing coverage, and TUI-visible.

Contracts covered in this chunk:

- Real Mastra Code startup in a temp git repo shows the live long branch in startup context.
- The status footer preserves branch context by falling back to the abbreviated long-branch form `feature/supe..tra-long` before lossy path truncation can win.
- Status-line fallback ordering rejects truncation for full path+branch and full branch-only candidates so the branch abbreviation candidate can render.

Tests/changes:

- Strengthened `mastracode/scripts/mc-e2e/scenarios/branch-context-long-name.ts` to assert the footer abbreviation, not only startup branch context.
- Added `mastracode/src/tui/__tests__/status-line.test.ts` coverage for the narrow-width fallback.
- Fixed `mastracode/src/tui/status-line.ts` fallback ordering by adding `allowDirTruncation: false` to the full path+branch and branch-only attempts.
- Added a file-local lint disable to `mastracode/scripts/index-messages.ts`, a one-time migration script with intentional console output and legacy import style, so `pnpm --filter ./mastracode lint` can run cleanly.

Break-validation evidence:

1. Re-allowed full path+branch truncation; `pnpm --filter ./mastracode run e2e:test branch-context-long-name` failed waiting for `/feature\/supe\.\.tra-long/` while the footer showed a truncated path. Reverted.
2. Changed the abbreviation prefix from 12 chars to 10; `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/status-line.test.ts --bail=1 --reporter=dot` failed because the footer rendered `feature/su..tra-long`. Reverted.
3. Raised the abbreviation threshold so long branches did not abbreviate; the same focused status-line test failed because the footer rendered a truncated full branch. Reverted.

Verification:

- `pnpm run build:mastracode` — passed.
- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/status-line.test.ts --bail=1 --reporter=dot` — 1 file / 14 tests passed.
- `pnpm --filter ./mastracode run e2e:test branch-context-long-name` — 1 TUI e2e passed.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` — 3 TUI e2e scenarios passed; automated-chat AIMock request count 1.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.

### Test recovery: audit-tests subagent removal

Selected `Subagents: Audit-tests subagent` as the next High-risk Missing row. Source verification confirmed the feature card's disposition: `mastracode/src/agents/subagents/audit-tests.ts` existed, but `createMastraCode()` default subagents only include Explore, Plan, and Execute; the base prompt still advertised a stale `audit-tests` single-use exception.

Resolution: remove the unavailable built-in subagent rather than revive it. Future test-audit behavior should be designed as a skill or slash command with separate coverage.

Changes:

- Deleted `mastracode/src/agents/subagents/audit-tests.ts`.
- Removed the stale single-use `audit-tests` exception from `mastracode/src/agents/prompts/base.ts`.
- Added prompt regression coverage in `mastracode/src/agents/__tests__/prompts.test.ts` so the base prompt does not advertise `audit-tests` or a single-use subagent exception.
- Added `.changeset/quiet-ravens-audit.md` for the MastraCode package patch.
- Updated the audit-tests feature card and test recovery tracker row.

Break-validation evidence:

1. Reintroduced the stale `audit-tests` prompt exception; `pnpm --filter ./mastracode exec vitest run src/agents/__tests__/prompts.test.ts --bail=1 --reporter=dot` failed on the prompt regression assertion. Reverted.
2. Recreated a production `audit-tests.ts` source file; `test -z "$(rg -n "audit-tests|auditTestsSubagent|Audit Tests" mastracode/src --glob '!**/__tests__/**')"` failed. Reverted.
3. Reintroduced generic single-use subagent guidance without the `audit-tests` id; the prompt regression test failed on `subagent may be used on its own`. Reverted.

Verification:

- `rg -n "audit-tests|auditTestsSubagent|Audit Tests" mastracode/src` — only the new prompt regression test references remain.
- `pnpm --filter ./mastracode exec vitest run src/agents/__tests__/prompts.test.ts src/agents/subagents/execute.test.ts --bail=1 --reporter=dot` — 2 files / 8 tests passed.
- `test -z "$(rg -n "audit-tests|auditTestsSubagent|Audit Tests" mastracode/src --glob '!**/__tests__/**')"` — passed.
- `pnpm run build:mastracode` — passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.

### Test recovery: observational memory factory defaults

Selected `Memory: Observational memory` as the next High-risk row. Chose the Mastra Code-specific missing gap for `getDynamicMemory()` wiring because it is compact, high-impact, and protects the product boundary between Mastra Code state and core memory configuration.

Added `mastracode/src/agents/memory.test.ts` with a mocked `Memory` constructor. The tests assert:

- OM is enabled with `temporalMarkers: true`, `activateAfterIdle: 'auto'`, `activateOnProviderChange: true`, thread-title observation, prior-observation token window, and default thresholds.
- `getOmScope(projectPath)` is used only when harness state does not already provide `omScope`.
- Resource scope disables async observation/reflection buffering (`bufferTokens: false`, buffer activations undefined).
- Harness state threshold, observer/reflector model, caveman, and attachment-observation overrides flow into the memory config.
- Observer/reflector model callbacks preserve `requestContext` while resolving models with Codex remapping enabled.

Break-validation evidence:

1. Removed `activateAfterIdle: 'auto'`; `pnpm --filter ./mastracode exec vitest run src/agents/memory.test.ts --bail=1 --reporter=dot` failed on the activation-default assertion. Reverted.
2. Re-enabled async observation buffering for resource scope; the focused test failed on `bufferTokens: false` / undefined buffer activation expectations. Reverted.
3. Dropped `requestContext` from observer model resolution; the focused test failed on the `resolveModel()` call shape. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/agents/memory.test.ts --bail=1 --reporter=dot` — 1 file / 2 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 tasks.

### Test recovery: startup performance warning/sync contract

Selected `Setup: Startup performance` as the next High-risk row. Chose the missing warning/slow-gateway regression because it protects the core startup optimization contract without relying on brittle wall-clock benchmarks: gateway sync must remain backgrounded, storage warnings must still be returned for TUI rendering, and startup must still request a forced gateway registry refresh.

Added coverage in `mastracode/src/index.test.ts`:

- Mocks a never-resolving `GatewayRegistry.syncGateways(true)` call.
- Mocks storage initialization returning `warning: 'Storage fallback warning'`.
- Races `createMastraCode()` against a timeout to prove startup does not await gateway sync.
- Asserts the returned `storageWarning` survives for `main.ts` warning rendering.
- Asserts startup still calls `syncGateways(true)`.

Break-validation evidence:

1. Changed background sync to `await Promise.resolve(gatewayRegistry.syncGateways(true))`; focused test timed out with `createMastraCode waited for gateway sync`. Reverted.
2. Dropped returned `storageWarning`; focused test failed on the warning assertion. Reverted.
3. Changed startup sync to `syncGateways(false)`; focused test failed on the forced-sync assertion. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/index.test.ts src/__tests__/index.test.ts --bail=1 --reporter=dot` — 2 files / 18 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 tasks.

### Test recovery: headless prompt output-format contracts

Selected `Headless: Prompt mode` as the next High-risk row. Chose the automation output-format gap because scripts depend on stable stdout/stderr behavior: `text` must print only final assistant text, `json` must print one final summary object, and `stream-json` must print newline-delimited runtime Harness events.

Added coverage in `mastracode/src/headless-integration.test.ts`:

- `--output-format text` asserts stdout is exactly the final assistant response plus newline and stderr stays empty for a simple run.
- `--output-format json` asserts stdout contains one final summary object with assistant text, completion reason, thread id, and empty tool arrays, with no event `type` field.
- `--output-format stream-json` asserts stdout is parseable NDJSON containing runtime events including `agent_start`, assistant `message_end`, and `agent_end`, without collapsing to the final text summary shape.

Break-validation evidence:

1. Disabled text output buffering; focused output-format tests failed because text mode produced empty stdout. Reverted.
2. Treated `--output-format json` like stream-json; focused output-format tests failed because JSON mode emitted 16 event lines instead of one summary object. Reverted.
3. Disabled stream-json event emission; focused output-format tests failed parsing missing NDJSON events. Reverted.

Verification:

- `env -u OPENAI_API_KEY -u OPENAI_BASE_URL pnpm --filter ./mastracode exec vitest --run src/headless-integration.test.ts --bail 1 --reporter=dot` — 1 file / 26 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 tasks.

### Test recovery: interactive prompts sensitive input masking

Selected `TUI: Interactive prompts and access requests` as the next High-risk row. Chose the direct `MaskedInput` gap because it protects sensitive API-key/login/storage prompts without requiring a brittle full PTY flow: render must hide cleartext, but the backing value and submit callback must keep the raw secret.

Added `mastracode/src/tui/components/__tests__/masked-input.test.ts` with a mocked `@mariozechner/pi-tui` `Input`:

- Rendering a secret shows only `*` characters and never includes the cleartext value.
- Rendering restores the underlying value after the temporary mask swap.
- Submitting after render forwards the unmasked value.

Break-validation evidence:

1. Rendered the wrapped `Input` directly without masking; focused test failed because cleartext appeared and expected mask characters were missing. Reverted.
2. Restored an empty value instead of the real value after render; focused test failed because `getValue()` no longer returned the secret. Reverted.
3. Wrapped `onSubmit` to forward masked characters; focused test failed because submit received stars instead of the storage URL. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest --run src/tui/components/__tests__/masked-input.test.ts --bail 1 --reporter=dot` — 1 file / 2 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 tasks.

### Test recovery: clipboard text paste shortcut

Selected `TUI: Clipboard paste` as the next High-risk row. Chose the explicit Ctrl+V text-paste gap because existing tests already covered image/path paste and Alt+V image paste, but did not prove host clipboard text takes the terminal-native bracketed-paste path.

Extended `mastracode/src/tui/components/__tests__/custom-editor.test.ts`:

- Ctrl+V triggers explicit paste handling.
- Explicit paste checks clipboard image data first when image paste is wired, preserving image priority.
- If no clipboard image is available, clipboard text is wrapped in `\x1b[200~` / `\x1b[201~` bracketed-paste markers before passing to the editor.

Break-validation evidence:

1. Removed Ctrl+V from the explicit paste shortcut branch; focused test failed because clipboard helpers were never called. Reverted.
2. Passed clipboard text directly to the editor without bracketed-paste markers; focused test failed on the `super.handleInput()` payload. Reverted.
3. Removed image-first clipboard detection from explicit paste; focused test failed because `getClipboardImage()` was not called before text fallback. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest --run src/tui/components/__tests__/custom-editor.test.ts --bail 1 --reporter=dot` — 1 file / 17 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 tasks.

### Test recovery: configuration modal question overlay lifecycle

Selected `TUI: Configuration modal overlays` as the next High-risk row. Chose the direct `askModalQuestion()` gap because many configuration commands depend on this shared helper to keep modal focus contained, hide overlays on completion, and return the correct submit/cancel value.

Added `mastracode/src/tui/__tests__/modal-question.test.ts` with mocked dialog and overlay modules:

- `askModalQuestion()` creates and focuses the dialog component.
- `showModalOverlay()` receives the dialog plus merged default/custom overlay options.
- Submit hides the overlay and resolves the submitted answer.
- Cancel hides the overlay and resolves `null`.

Break-validation evidence:

1. Removed `question.focused = true`; focused test failed because the dialog stayed unfocused. Reverted.
2. Removed `tui.hideOverlay()` from submit; focused test failed because submit did not clear the overlay. Reverted.
3. Resolved cancel as a non-null string; focused test failed because cancel no longer resolved `null`. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest --run src/tui/__tests__/modal-question.test.ts --bail 1 --reporter=dot` — 1 file / 2 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 tasks.

### Test recovery: quiet-mode pending tool errors

Selected `TUI: Quiet mode` as the next High-risk row. Chose the error/abort missing-test gap because quiet compact tools must still surface failed pending results when an assistant run ends with an error.

Extended `mastracode/src/tui/handlers/__tests__/message.test.ts`:

- Starts a quiet-mode pending tool through `handleMessageUpdate()` so the real compact tool setup path runs.
- Ends the assistant run with `handleMessageEnd()` and `stopReason: 'error'`.
- Asserts the compact tool renders the failed badge and real error message without expanding to the classic box UI.
- Asserts `pendingTools` is cleared so the failed tool does not remain registered as pending.

Break-validation evidence:

1. Changed pending-tool error updates to `isError: false`; focused test failed because the failed badge disappeared. Reverted.
2. Dropped the assistant run's real `errorMessage`; focused test failed because the specific error text was lost. Reverted.
3. Removed `pendingTools.clear()` from the error path; focused test failed because the failed tool stayed pending. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest --run src/tui/handlers/__tests__/message.test.ts --bail 1 --reporter=dot` — 1 file / 17 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 tasks.

### Test recovery: onboarding registry provider API-key access

Selected `Settings: Onboarding and global settings` as the next High-risk row. Chose the non-hardcoded provider access gap because setup/startup must count provider API-key env vars from provider registry metadata, including providers with multiple accepted env var names.

Extended `mastracode/src/__tests__/index.test.ts`:

- Mocked `PROVIDER_REGISTRY` as a mutable registry in the startup test harness.
- Fixed the existing packs mock path so `index.ts` pack resolution is intercepted by the test.
- Added startup coverage where a custom registry provider declares `apiKeyEnvVar: ['MC_E2E_PRIMARY_KEY', 'MC_E2E_SECONDARY_KEY']` and only the secondary env var is set.
- Asserted both mode-pack and OM-pack resolution receive that provider as `apikey` access.

Break-validation evidence:

1. Considered only the first env var from `apiKeyEnvVar`; focused test failed because the secondary key no longer counted. Reverted.
2. Required every configured env var to be present; focused test failed because any configured key should count. Reverted.
3. Found the env var but marked provider access as `false`; focused test failed because pack resolution did not receive `apikey`. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest --run src/__tests__/index.test.ts --bail 1 --reporter=dot` — 1 file / 17 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 tasks.

### Test recovery: custom config directory startup alignment

Selected `Settings: Custom config directory` as the next High-risk row. Chose the startup alignment gap because `config.configDir` must stay in sync across service initialization and runtime Harness state, and must not be overridden by `initialState.configDir`.

Extended `mastracode/src/__tests__/index.test.ts`:

- Mocked startup path consumers for storage, MCP, hooks, and resource-id override lookup.
- Added coverage for `createMastraCode({ configDir: '.acme-code', initialState: { configDir: '.wrong-code' } })`.
- Asserted storage, MCP, hooks, and resource-id override lookup receive `.acme-code`.
- Asserted Harness `initialState.configDir` is `.acme-code`, not the conflicting initial state value.

Break-validation evidence:

1. Passed `DEFAULT_CONFIG_DIR` to storage config lookup; focused test failed because storage used `.mastracode`. Reverted.
2. Passed `DEFAULT_CONFIG_DIR` to MCP config loading; focused test failed because MCP used `.mastracode`. Reverted.
3. Spread `config.initialState` after `configDir`; focused test failed because `.wrong-code` reached Harness state. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest --run src/__tests__/index.test.ts --bail 1 --reporter=dot` — 1 file / 18 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 tasks.

### Test recovery: storage backend settings overlay

Selected `Settings: Storage backend configuration` as the next High-risk row. Chose the direct `/settings` storage backend submenu gap because existing coverage already protects storage precedence, PG fallback, vector-store pairing, and settings schema parsing, but not the TUI submenu contract for saving/canceling backend connection input.

Added `mastracode/src/tui/components/__tests__/settings.test.ts` with a focused pi-tui mock. The tests assert:

- Selecting PostgreSQL enters the connection prompt and normalized Enter saves the unmasked connection string through `onStorageBackendChange('pg', connectionUrl)`.
- Selecting LibSQL with empty input and raw Enter saves default local-file semantics by passing `undefined`, not an empty connection URL.
- Raw Escape in the connection prompt cancels without calling the storage-save callback or mutating backend state.

Break-validation evidence:

1. Removed normalized Enter handling from `StorageBackendSubmenu.handleInput()`; `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/settings.test.ts --bail 1 --reporter=dot` failed because the PostgreSQL save callback was never called. Reverted.
2. Changed empty LibSQL input to pass `''` instead of `undefined`; the focused test failed on the default-local callback contract. Reverted.
3. Removed raw `\x1b` Escape handling; the focused test failed because the submenu did not call the cancel `done()` callback. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/components/__tests__/settings.test.ts --bail 1 --reporter=dot` — 1 file / 3 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 cached.

Committed as `00c35d1721` (`test(mastracode): shield storage settings overlay`).

### Test recovery: interactive chat state defaults

Selected `TUI: Interactive chat` as the next High-risk row. Chose the missing `createTUIState()` default-shape gap because existing queueing, shortcut, render, hook, and shell tests hand-build partial state objects; a missing factory default can therefore break real chat handlers at runtime without failing those tests.

Added `mastracode/src/tui/__tests__/state.test.ts` with focused mocks for the pi-tui shell and editor. The test asserts the shared TUI runtime starts with the maps, sets, queues, flags, dependency references, project info, model auth status, and mode-color callback that chat handlers rely on.

Break-validation evidence:

1. Initialized `pendingSignalMessageComponentsById` as an array instead of a `Map`; `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/state.test.ts --bail 1 --reporter=dot` failed on the map-shape assertion. Reverted.
2. Defaulted `pendingNewThread` to `true`; the focused test failed because idle chat must not create a new thread unless startup/thread logic requests one. Reverted.
3. Defaulted `hideThinkingBlock` to `false`; the focused test failed on the chat display default. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/state.test.ts --bail 1 --reporter=dot` — 1 file / 1 test passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 cached.

Committed as `0ae15b3c70` (`test(mastracode): shield tui state defaults`).

### Test recovery: prompt instruction loading

Selected `Chat: Prompt context and project instructions` as the next High-risk row. Chose the static instruction-loader gap because prompt assembly already had model/task/base guidance coverage, while `loadAgentInstructions()` precedence and custom config-dir behavior had no direct regression shield.

Added `mastracode/src/agents/prompts/agent-instructions.test.ts`. The tests assert:

- Project `AGENTS.md` wins over `CLAUDE.md` at the same location.
- Singular `AGENT.md` is ignored and never loaded as static prompt guidance.
- A custom config directory is substituted into project-local instruction paths and XDG global `.config/<configDir>` paths.
- Global static instructions are returned before project instructions.

Break-validation evidence:

1. Added `AGENT.md` to the instruction file list before `AGENTS.md`; `pnpm --filter ./mastracode exec vitest run src/agents/prompts/agent-instructions.test.ts --bail 1 --reporter=dot` failed because the singular file loaded. Reverted.
2. Reordered file precedence to prefer `CLAUDE.md` over `AGENTS.md`; the focused test failed because the CLAUDE fallback loaded. Reverted.
3. Removed project custom configDir substitution; the focused test failed because project `.acme-code/CLAUDE.md` was not loaded. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/agents/prompts/agent-instructions.test.ts --bail 1 --reporter=dot` — 1 file / 2 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 cached.

Committed as `fe89ef9b9f` (`test(mastracode): shield prompt instruction loading`).

### Test recovery: file attachment message input

Selected `Chat: File attachments in chat input` as the next High-risk row. Chose the direct Harness boundary gap because lower layers already covered signal adapters and observational-memory attachment handling, while `sendMessage({ content, files })` conversion itself lacked a precise shield.

Added coverage in `packages/core/src/harness/signal-messages.test.ts` asserting:

- Text attachments are converted into model-visible text parts labeled with `[File: <filename>]`.
- Base64 data-URI text attachments are decoded before fencing.
- Binary attachments remain `file` parts and preserve `data`, `mediaType`, and `filename`.
- Text attachment fences use a longer backtick run than any backtick sequence inside the file content.

Break-validation evidence:

1. Changed text-file detection to no longer treat `text/plain` as text; focused signal-message tests failed because `snippet.ts` became a binary file part. Reverted.
2. Dropped filename propagation for binary file parts; focused signal-message tests failed because `archive.bin` was missing. Reverted.
3. Replaced dynamic fence length with a fixed triple-backtick fence; focused signal-message tests failed for markdown containing triple backticks. Reverted.

Verification:

- `pnpm --filter ./packages/core exec vitest run src/harness/signal-messages.test.ts --bail 1 --reporter=dot` — 1 file / 28 tests passed.
- `pnpm --filter ./packages/core check` — passed.
- `pnpm build:core` — passed, 12/12 tasks.

Committed as `494be0ca3f` (`test(core): shield harness file attachments`).

### Test recovery: queued slash command arguments

Selected `Chat: Queued follow-ups and slash commands` as the next High-risk row. Chose the custom slash-command processor gap from #13493 because queueing/autocomplete/status behavior already has focused coverage, while argument preservation for custom queued slash commands was only documented in the feature map.

Expanded `mastracode/src/utils/__tests__/slash-command-processor.test.ts` to assert:

- Custom commands with no placeholders append unused raw args as an `ARGUMENTS:` block after shell/file expansion.
- `$ARGUMENTS` and positional placeholders consume args and suppress duplicate raw-arg append.
- `$1+` expands to the rest of the supplied args and suppresses duplicate raw-arg append.
- `$0` remains literal shell text instead of being treated as a positional argument.

The new `$1+` test exposed a product bug: `Review $1+` became `Review src/index.ts+`. Fixed `replaceArguments()` to expand `$N+` before single positional replacement and to clear unused range placeholders.

Break-validation evidence:

1. Disabled raw-arg append; focused processor tests failed because no-placeholder commands lost `ARGUMENTS: prod blue`. Reverted.
2. Removed `$N+` range replacement; focused processor tests failed because `Review $1+` became `Review src/index.ts+`. Reverted.
3. Treated `$0` as a positional placeholder by broadening the positional detector to `$\d+`; focused processor tests failed because `$0` suppressed raw-arg append. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/utils/__tests__/slash-command-processor.test.ts --bail 1 --reporter=dot` — 1 file / 5 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 tasks.

Committed as `833684c417` (`fix(mastracode): preserve slash command range args`).

### Test recovery: agent signal reload rendering

Selected `Chat: Agent signals and streaming follow-ups` as the next High-risk row. Chose the cross-reload TUI reconstruction gap because core signal persistence and active-run echo behavior already had broad coverage, but `renderExistingMessages()` did not directly prove persisted active signal messages reload without stale pending previews.

Added `renderExistingMessages signals` coverage in `mastracode/src/tui/__tests__/render-messages.test.ts`. The test seeds a stale pending interjection preview, reloads persisted history containing a `delivery="while-active"` user signal, and asserts:

- `renderExistingMessages()` clears stale pending signal preview state.
- The chat container is rebuilt from persisted history, not appended to stale pending UI.
- The persisted signal is rendered as a confirmed `UserMessageComponent` and registered in `messageComponentsById`.
- The `steer` label survives reload from the persisted `delivery="while-active"` attribute.
- The stale preview text is not rendered.

Break-validation evidence:

1. Removed `state.chatContainer.clear()` from `renderExistingMessages()`; focused render-message tests failed because stale pending UI remained alongside history. Reverted.
2. Removed `state.pendingSignalMessageComponentsById.clear()` from reload; focused tests failed because stale pending signal state survived. Reverted.
3. Ignored `delivery="while-active"` in `getUserMessageLabel()`; focused tests failed because persisted active signals lost the `steer` label. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/__tests__/render-messages.test.ts --bail 1 --reporter=dot` — 1 file / 25 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 cached.

Committed as `9ac78cd1c3` (`test(mastracode): shield signal reload rendering`).

### Test recovery: processor state signals headless output

Selected `Chat: Processor state signals` as the next High-risk Partial row. Existing core and TUI coverage already protects processor state-signal generation, dedupe, browser snapshot/delta computation, streamed TUI rendering, and loaded-history rendering. The selected missing contract for this chunk was the headless automation boundary: `--output-format stream-json` must expose state-signal content parts outside the TUI.

Changes:

- Added `mastracode/src/headless-integration.test.ts` coverage proving stream-json `message_end` events preserve `state_signal` parts alongside assistant text and still emit the final `agent_end` completion marker.
- Updated `processor-state-signals.md` to mark the headless output gap covered while leaving live browser reload parity and long-session snapshot/delta pruning as remaining gaps.
- Marked the tracker row validated with evidence commit `94dd46b221`.

Break-validation evidence:

1. Sanitized stream-json `message_end` content to text-only; the focused test failed because the `state_signal` part disappeared. Reverted.
2. Removed explicit `stream-json` support from the NDJSON emitter; the focused test failed while parsing missing events. Reverted.
3. Suppressed the `agent_end` event in stream-json output; the focused test failed on the missing completion marker. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/headless-integration.test.ts --bail 1 --reporter=dot` — 1 file / 27 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 cached.

### Test recovery: notification inbox read wrapper

Selected `Chat: Notification inbox signals` as the next High-risk Partial row. Existing core coverage already protects the raw notification storage/tool APIs and TUI notification rendering. The selected missing boundary for this chunk was Mastra Code's dynamic-tool wrapper: after a notification summary, `notification_inbox read` must resolve against the current thread, reach the notifications storage domain through the lazy adapter, deliver unread details, and mark the record seen.

Changes:

- Extended `mastracode/src/agents/extra-tools.test.ts` with coverage for `notification_inbox read` through `createDynamicTools()`.
- The test proves the wrapper calls `getNotification({ threadId, id })`, sends the notification signal to the current thread/resource, and updates the notification record to `seen` with the delivered signal id.
- Updated `notification-inbox-signals.md` and the recovery tracker with the new evidence while leaving full model-driven e2e and real-storage persistence/reload gaps listed for future work.

Break-validation evidence:

1. Broke the lazy `getNotification` proxy; the focused test failed before delivery because the notification could not be found. Reverted.
2. Broke the lazy `updateNotification` proxy; the focused test failed because the seen-status update never reached the notifications storage domain. Reverted.
3. Bypassed the lazy notifications-domain adapter and passed the composite store directly to the inbox tool; the focused test failed because `storage.getNotification` was missing. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/agents/extra-tools.test.ts --bail 1 --reporter=dot` — 1 file / 20 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 cached.

### Test recovery: GitHub signal subscription tool context

Selected `Git: GitHub signal subscriptions` as the next High-risk Partial row. During contract extraction, the feature card still mentioned an agent-end branch auto-subscribe hook that is not present in the current branch. The current deterministic gap was the `@mastra/github-signals` tool boundary: `github_subscribe_pr` and `github_unsubscribe_pr` expose a tool execution context with `agent.threadId` / `agent.resourceId`, but the implementation ignored it and always used the processor request context captured when tools were created. That can mutate the wrong thread when a tool executes with an explicit current thread context.

Changes:

- Updated `signals/github/src/index.ts` so subscription tools prefer explicit tool execution `agent.threadId` / `agent.resourceId`, falling back to the processor request context when execution context is absent.
- Added `signals/github/src/index.test.ts` coverage proving subscribe and unsubscribe both target the explicit tool execution thread and leave the captured request-context thread untouched.
- Added `.changeset/soft-signals-thread.md` for `@mastra/github-signals`.
- Updated `github-signal-subscriptions.md` to reflect the current source layout and remove stale auto-subscribe references.

Break-validation evidence:

1. Forced both tools back to captured request-context thread IDs; the new explicit-context test failed because storage looked up the captured thread instead of the execution thread. Reverted.
2. Removed fallback to processor context; the existing context-less tool execution test failed with missing thread/resource context. Reverted.
3. Made unsubscribe ignore explicit execution context while subscribe honored it; the new paired test failed because the explicit thread remained subscribed. Reverted.

Verification:

- `pnpm --filter @mastra/github-signals test -- --run src/index.test.ts --bail 1 --reporter=dot` — 1 file / 33 tests passed.
- `pnpm --filter @mastra/github-signals lint` — passed.
- `pnpm --filter @mastra/github-signals build` — passed.
- `pnpm --filter @mastra/github-signals exec tsc --noEmit` — passed.
- `pnpm run build:mastracode` — passed, 24/24.

### Test recovery: persistent conversation title resume

Selected `Threads: Persistent conversations / switching` as the next High-risk Partial row. The selected gap was the headless `--thread <title>` path after Harness v1 session prefill. `HarnessCompat.listThreads()` projected v1 session-backed rows with session metadata but did not copy the legacy thread title onto the projected row, so headless title resolution could fail even though the persisted legacy thread still had a title.

Changes:

- Updated `mastracode/src/HarnessCompat.ts` so v1 session-backed thread projections include `title: legacyThread?.title` while preserving session metadata and dedupe.
- Added `mastracode/src/headless-integration.test.ts` coverage proving headless `--thread prefilled-title` resumes a Harness v1 prefilled session by legacy title, opens the v1 session with the current resource, returns one projected thread row, and retains `sessionId`/`modeId`/`modelId` metadata.
- Added `.changeset/quiet-threads-resume.md` for `mastracode`.

Break-validation evidence:

1. Removed the v1 title projection; the focused test failed because `runHeadless()` returned exit code 1 with `No thread found matching "prefilled-title"`. Reverted.
2. Made `HarnessCompat.switchThread()` omit the current resource when opening the v1 session; the focused test failed because `harnessV1.session()` received `resourceId: undefined`. Reverted.
3. Dropped session metadata from projected thread rows; the focused test failed because `sessionId`/`modeId`/`modelId` were missing from `targeted.metadata`. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/headless-integration.test.ts --bail 1 --reporter=dot` — 1 file / 28 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24.

### Test recovery: resource-scoped headless thread selection

Selected `Threads: Resource ID switching` as the next High-risk Partial row. The selected gap was the headless contract combining `--resource-id`, `--thread`, and `--continue` across multiple resource scopes. Existing tests covered parser behavior and TUI command mocks, but not storage-backed headless selection across duplicate thread titles and latest-thread resume semantics.

Changes:

- Added `mastracode/src/headless-integration.test.ts` coverage that creates threads in `resource-a` and `resource-b`, including duplicate `shared-title` threads, then proves `--resource-id resource-b --thread shared-title` resumes the `resource-b` thread and `--resource-id resource-a --continue` resumes the latest `resource-a` thread rather than an older same-resource thread or a recently updated different-resource thread.

Break-validation evidence:

1. Skipped `harness.setResourceId()` for `--resource-id`; the focused test failed because the harness stayed in `resource-a` when `resource-b` was requested. Reverted.
2. Made `--continue` call `listThreads({ allResources: true })`; the focused test failed because it resumed the recently updated `resource-b` thread while `resource-a` was active. Reverted.
3. Reversed the `--continue` updatedAt sort; the focused test failed because it resumed the older `resource-a` thread instead of the latest one. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/headless-integration.test.ts --bail 1 --reporter=dot` — 1 file / 29 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — passed, 24/24 cached.

### Test recovery: model preservation on Harness v1 thread switch

Selected `Models: Model auth, selection, modes` as the next High-risk row. Chose the missing contract for per-thread/per-session model preservation because `HarnessCompat.switchThread()` was resetting prefilled Harness v1 sessions to the mode default during title-based headless resumes.

Changes:

- Fixed `mastracode/src/HarnessCompat.ts` so `switchThread()` loads the v1 session without calling `setModelId(defaultModelId)`.
- Extended the existing headless v1 prefilled-thread test in `mastracode/src/headless-integration.test.ts` to use a non-default session model (`openai/custom-thread-model`), assert no reset call, and verify projected thread metadata keeps the v1 session model.
- Added `.changeset/quiet-models-switch.md` for the MastraCode patch.
- Updated the model-auth feature card and recovery tracker row.

Break-validation evidence:

1. Reintroduced `session.setModelId(defaultModelId)` during v1 thread switch; the focused test failed on an unexpected `setModelId('mock-model')` call. Reverted.
2. Removed v1 session `modelId` from projected thread metadata; the focused test failed because `modelId` was missing from thread metadata. Reverted.
3. Projected legacy `currentModelId` instead of the v1 session `modelId`; the focused test failed because metadata reported default `mock-model` instead of `openai/custom-thread-model`. Reverted.

Verification:

- `env -u OPENAI_API_KEY -u OPENAI_BASE_URL pnpm --filter ./mastracode exec vitest run src/headless-integration.test.ts --reporter=dot` — 1 file / 29 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — 24/24 tasks passed.

Commits:

- `b2aff24866` — `fix(mastracode): preserve v1 session model on thread switch` (pushed to `origin/tests/mc`).

### Test recovery: custom provider model catalog merge

Selected `Models: Custom OpenAI-compatible providers` as the next High-risk row. Chose the Harness `listAvailableModels()` gap because MastraCode custom OpenAI-compatible providers depend on this core hook to surface provider models in model selectors and OM selectors.

Changes:

- Added `packages/core/src/harness/list-available-models.test.ts`.
- The test proves custom catalog entries merge into the registry-backed model list, custom entries can override duplicate built-in IDs such as `openai/gpt-4o`, external model use counts are applied to custom entries, and `invalidateAvailableModelsCache()` forces the custom catalog provider to be re-read after provider edits.
- Updated the custom-provider feature card and recovery tracker row.

Break-validation evidence:

1. Disabled the custom catalog branch in `Harness.listAvailableModels()`; the focused test failed because the built-in OpenAI model was not overridden by the custom provider entry. Reverted.
2. Changed the model upsert helper to preserve the first duplicate ID instead of overwriting; the focused test failed because the built-in `openai/gpt-4o` entry won over the custom entry. Reverted.
3. Made `invalidateAvailableModelsCache()` a no-op; the focused test failed because the catalog provider was not called a second time and stale custom models remained cached. Reverted.

Verification:

- `pnpm --filter ./packages/core exec vitest run src/harness/list-available-models.test.ts --reporter=dot` — 1 file / 1 test passed.
- `pnpm --filter ./packages/core check` — passed.
- `pnpm build:core` — 12/12 tasks passed.

Commits:

- `418b7a9fda` — `test(core): shield custom model catalog merge` (pushed to `origin/tests/mc`).

### Test recovery: Codex thinking request shape

Selected `Models: Thinking and reasoning effort` as the next High-risk row. Chose the provider request-shape gap because it directly protects the runtime boundary that maps Mastra Code thinking settings into OpenAI Codex requests.

Changes:

- Extended `mastracode/src/providers/__tests__/openai-codex-fetch.test.ts` with a direct `createCodexMiddleware()` request-shape test.
- The test proves Codex middleware preserves existing OpenAI provider options, injects required instructions, forces `store: false`, emits the selected `reasoningEffort`, and removes `topP` when `temperature` is set.
- Updated the thinking/reasoning feature card and recovery tracker row.

Break-validation evidence:

1. Removed `reasoningEffort` injection from Codex provider options; the focused provider test failed. Reverted.
2. Removed `store: false`; the focused provider test failed. Reverted.
3. Stopped removing `topP` when `temperature` is set; the focused provider test failed. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/providers/__tests__/openai-codex-fetch.test.ts --reporter=dot` — 1 file / 3 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — 24/24 tasks passed.

Commits:

- `e50141efa8` — `test(mastracode): shield codex thinking request shape` (pushed to `origin/tests/mc`).

### Test recovery: OpenAI strict structured-output schema shape

Selected `Models: OpenAI strict schema compatibility` as the next High-risk row. Chose the local Agent structured-output boundary because it proves the no-network path that applies OpenAI provider detection, null-to-undefined parsing, and strict response schema serialization before a model request.

Changes:

- Extended `packages/core/src/agent/__tests__/structured-output-openai-compat.test.ts` with a direct model-capture assertion for the generated `responseFormat.schema`.
- The test now proves provider-only OpenAI models with undefined `modelId` still receive a strict JSON schema containing all required keys and recursive `additionalProperties: false` markers.

Break-validation evidence:

1. Made OpenAI compat depend only on `modelId`; the focused test failed because provider-only OpenAI models lost null-transform handling. Reverted.
2. Dropped the structured-output schema before model generation; the focused test failed because no structured object was parsed. Reverted.
3. Passed the raw schema without `wrapSchemaWithNullTransform`; the focused test failed on OpenAI-style `null` for optional fields. Reverted.

Verification:

- `pnpm --filter ./packages/core exec vitest run src/agent/__tests__/structured-output-openai-compat.test.ts --reporter=dot --bail=1` — 1 file / 6 tests passed.
- `pnpm --filter ./packages/core check` — passed.
- `pnpm build:core` — 12/12 tasks passed.

Commits:

- `33665d4a24` — `test(core): shield openai strict schema shape` (pushed to `origin/tests/mc`).

### Test recovery: built-in tool schema compatibility

Selected `Models: Tool schema compatibility` as the next High-risk row. Chose the routed Zod v4 schema-compat boundary because it protects provider-facing serialization for built-in Mastra Code command tool schemas when a Zod v4 schema exposes `_zod` but lacks native `~standard.jsonSchema`.

Changes:

- Extended `packages/schema-compat/src/standard-schema/adapters/zod-v4.test.ts` with routed serialization coverage for `ask_user`, `task_write`, `task_check`, and `submit_plan` schema shapes.
- The test deletes native `~standard.jsonSchema` from the Zod v4 schema instances to simulate the Zod 3.25 v4 compatibility export shape, then verifies `standardSchemaToJSONSchema(toStandardSchema(schema), { io: 'input' })` still emits object schemas with expected nested properties.
- Updated the feature card and recovery tracker row.

Break-validation evidence:

1. Disabled routed Zod v4 fallback for schemas missing native `~standard.jsonSchema`; the focused test failed because serialized tool schemas lost properties. Reverted.
2. Removed the adapter's JSON Schema converter from the wrapper; the focused adapter test failed. Reverted.
3. Made provider-facing `standardSchemaToJSONSchema()` drop properties after conversion; the new focused test failed on missing tool schema properties. Reverted.

Verification:

- `pnpm --filter @mastra/schema-compat exec vitest run src/standard-schema/adapters/zod-v4.test.ts --reporter=dot --bail=1` — 1 file / 17 tests passed.
- `pnpm --filter @mastra/schema-compat build` — passed.
- `pnpm --filter @mastra/schema-compat exec tsc --noEmit` — passed.
- Attempted `pnpm test:core:zod` and `pnpm --filter ./packages/core typecheck:zod-compat`; both scripts are absent in this branch.

Commits:

- `ea0cf20e0b` — `test(schema-compat): shield builtin tool schemas` (pushed to `origin/tests/mc`).

### Test recovery: ProviderHistoryCompat custom rules

Selected `Models: Provider history compatibility` as the next High-risk row. Chose the downstream custom-rule gap because `ProviderHistoryCompat` is documented as extensible, but existing coverage only protected built-in rules.

Changes:

- Extended `packages/core/src/processors/provider-history-compat.test.ts` with custom reactive and preemptive rule coverage.
- The reactive test proves constructor-supplied rules can match plain API errors, mutate message history, and request one retry.
- The prompt test proves constructor-supplied `applyToPrompt` rules run after built-in prompt rewrites, receive the resolved model, and can chain changes onto the already-sanitized outbound prompt.
- Updated the provider-history feature card and recovery tracker row.

Break-validation evidence:

1. Ignored constructor `additionalRules`; the custom reactive rule did not retry. Reverted.
2. Stopped prompt rule processing after the first built-in rewrite; the custom prompt rule did not run after Cerebras stripping. Reverted.
3. Disabled plain-Error matching; the custom reactive rule was skipped. Reverted.

Verification:

- `pnpm --filter ./packages/core exec vitest run src/processors/provider-history-compat.test.ts --reporter=dot --bail=1` — 1 file / 35 tests passed.
- `pnpm --filter ./packages/core check` — passed.
- `pnpm build:core` — 12/12 tasks passed.

Commits:

- `2308242c19` — `test(core): shield provider history custom rules` (pushed to `origin/tests/mc`).

### Test recovery: Stream error retry processor ordering

Selected `Models: Stream error retry processor` as the next High-risk row. Chose the Mastra Code processor-ordering gap because core already covers retryable stream-error matching, matcher extensibility, cause chains, and retry caps, while Mastra Code only asserted the processor was present.

Changes:

- Tightened `mastracode/src/__tests__/index.test.ts` so `createMastraCode()` must wire error processors in this order: `StreamErrorRetryProcessor`, `PrefillErrorHandler`, `ProviderHistoryCompat`.
- Updated the stream-error-retry feature card and recovery tracker row.

Break-validation evidence:

1. Moved `PrefillErrorHandler` before stream retry; the focused startup test failed on exact order. Reverted.
2. Moved `ProviderHistoryCompat` before stream retry; the focused startup test failed on exact order. Reverted.
3. Removed `StreamErrorRetryProcessor` from Mastra Code wiring; the focused startup test failed on the missing first processor. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/__tests__/index.test.ts --reporter=dot --bail=1` — 1 file / 18 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — 24/24 tasks passed.

Commits:

- `e711e21922` — `test(mastracode): shield stream retry processor order` (pushed to `origin/tests/mc`).

### Test recovery: Coding tools LSP language IDs

Selected `Tools: Coding tools and approval permissions` as the next High-risk row. Chose the direct LSP language-ID gap because the feature card explicitly called out stale MC-local LSP mappings, and the current source had no direct tests proving TypeScript/JavaScript React files use real LSP IDs instead of raw extensions.

Changes:

- Added `mastracode/src/lsp/__tests__/language.test.ts`.
- The test covers `.ts`, `.tsx`, `.js`, and `.jsx`, and asserts each maps to the expected LSP language ID rather than the raw extension.
- Updated the coding-tools feature card and recovery tracker row.

Break-validation evidence:

1. Regressed `.tsx` to raw `tsx`; the focused LSP language test failed. Reverted.
2. Regressed `.jsx` to raw `jsx`; the focused LSP language test failed. Reverted.
3. Regressed `.ts` to raw `ts`; the focused LSP language test failed. Reverted.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/lsp/__tests__/language.test.ts --reporter=dot --bail=1` — 1 file / 4 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — 24/24 tasks passed.

Commits:

- `5cdb8f0bf9` — `test(mastracode): shield lsp language ids` (pushed to `origin/tests/mc`).

### Test recovery: Workspace-backed coding tools custom workspace startup

Selected `Tools: Workspace-backed coding tools` as the next High-risk row. Chose the Mastra Code config-boundary gap because the feature card listed missing coverage for `createMastraCode({ workspace })` passing a custom workspace through instead of falling back to the dynamic local workspace.

Changes:

- Extended `mastracode/src/__tests__/index.test.ts`.
- Added a startup regression shield proving custom `workspace` config is passed into Harness unchanged and does not invoke the default workspace factory.
- Added a companion fallback assertion proving no-override startup still passes a lazy workspace factory into Harness.
- Updated the workspace-tools feature card and recovery tracker row.

Break-validation evidence:

1. Ignored `config.workspace` and always passed `getDynamicWorkspace`; the custom-workspace startup test failed.
2. Dropped the default workspace fallback; the no-override startup test failed because Harness received no workspace factory.
3. Eagerly invoked `getDynamicWorkspace()` during startup; startup crashed before request context existed.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/__tests__/index.test.ts --reporter=dot --bail=1` — 1 file / 20 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — 24/24 tasks passed.

Commits:

- `7a36716a1f` — `test(mastracode): shield custom workspace startup` (pushed to `origin/tests/mc`).

### Test recovery: Streaming tool arguments handler parsing

Selected `Tools: Streaming tool arguments` as the next High-risk row. Chose the direct TUI handler gap because the feature card listed missing coverage for `handleToolInputDelta()` parsing partial JSON into `pendingTools`.

Changes:

- Added `mastracode/src/tui/handlers/__tests__/tool.test.ts`.
- The test proves `handleToolInputDelta()` reads the canonical Harness display-state buffer, parses partial JSON, updates the pending tool component with `isFinal=false`, refreshes/renders it, and ignores deltas for calls without a buffer.
- Updated the streaming-tool-arguments feature card and recovery tracker row.

Break-validation evidence:

1. Skipped pending component `updateArgs`; the focused handler test failed.
2. Parsed the latest delta fragment instead of the canonical display-state buffer; the focused handler test failed.
3. Accepted deltas without a display-state buffer; the focused handler test failed.

Verification:

- `pnpm --filter ./mastracode exec vitest run src/tui/handlers/__tests__/tool.test.ts --reporter=dot --bail=1` — 1 file / 3 tests passed.
- `pnpm --filter ./mastracode check` — passed.
- `pnpm --filter ./mastracode lint` — passed.
- `pnpm run build:mastracode` — 24/24 tasks passed.

Commits:

- `25781529a2` — `test(mastracode): shield streaming tool args` (pushed to `origin/tests/mc`).

### Test recovery: Task tracking restored-state split-brain shield

Selected `Tools: Task tracking tools and TUI progress` as the next High-risk row. Chose the split-brain reload/headless gap because the feature card listed the original failure mode where UI/prompt task state exists but task tools cannot find it.

Changes:

- Extended `packages/core/src/harness/task-tools.test.ts`.
- Added a compatibility-path regression shield where `harnessCtx.state` is stale/empty, `harnessCtx.getState()` returns restored tasks, and `task_complete` must find, mutate, persist, and emit `task_updated` for the restored task list.
- Updated the task-tracking feature card and recovery tracker row.

Break-validation evidence:

1. Preferred stale `state` over `getState()` in compatibility reads; the focused task tool test failed.
2. Skipped compatibility-path `setState`; the focused task tool test failed.
3. Skipped `task_updated` event emission; the focused task tool test failed.

Verification:

- `pnpm --filter ./packages/core exec vitest run src/harness/task-tools.test.ts --reporter=dot --bail=1` — 1 file / 31 tests passed.
- `pnpm --filter ./packages/core check` — passed.
- `pnpm --filter ./packages/core lint` — passed.
- `pnpm build:core` — 12/12 tasks passed.

Commits:

- `d01fbda0d1` — `test(core): shield restored task tool state` (pushed to `origin/tests/mc`).

### MCP status command recovery checkpoint

Validated `Integrations: MCP status and reload command` with command-level regression shields, committed as `312dd9cede`:
- Added `mastracode/src/tui/commands/__tests__/mcp.test.ts` proving `/mcp` opens the interactive selector when a configured `mcpManager` exists, and passes live status/reload/reconnect/log callbacks from the manager.
- Tightened `mastracode/src/tui/__tests__/command-dispatch.test.ts` to prove dispatcher passes the slash-command context containing `mcpManager` to `handleMcpCommand`.
- Break validations proven and reverted: dispatcher dropped `mcpManager`; command treated a configured manager as uninitialized; default `/mcp` bypassed the selector and showed text status.
- Verification: focused MCP command/dispatch tests, MastraCode typecheck, lint, and `pnpm run build:mastracode` all passed.

### MCP server configuration recovery checkpoint

Validated `Integrations: MCP server configuration` with a startup wiring regression shield, committed as `cf2b3ec325`:
- Added `mastracode/src/__tests__/index.test.ts` coverage proving `createMastraCode({ mcpServers })` passes programmatic stdio/HTTP server configs into `createMcpManager()` with the detected project root and configured `configDir`.
- Break validations proven and reverted: dropping `config.mcpServers`; ignoring custom `configDir`; using invocation cwd instead of detected project root.
- Verification: focused startup tests, MastraCode typecheck, lint, and `pnpm run build:mastracode` all passed.

### Core Harness API recovery checkpoint

Validated `Integrations: Core Harness API and reference docs` with a `createMastraCode({ memory, configDir })` startup API-boundary shield, committed as `a647f1747f`:
- Extended `mastracode/src/__tests__/index.test.ts` to prove caller-supplied memory is passed through to Harness without invoking the default dynamic-memory factory, while the configured `configDir` still owns storage, MCP, hooks, and runtime state even when `initialState.configDir` conflicts.
- Break validations proven and reverted: ignored caller memory; defaulted state `configDir` while custom memory was present; allowed `initialState.configDir` to override configured `configDir`.
- Verification: focused startup tests, MastraCode typecheck, lint, and `pnpm run build:mastracode` all passed.

### Browser automation recovery checkpoint

Validated `Integrations: Browser automation` with a direct `/browser on` command shield, committed as `a4004fcac4`:
- Added `mastracode/src/tui/commands/__tests__/browser.test.ts` proving enabled settings create a browser instance, attach it to all mode agents (including state-derived agents), persist `activeBrowserSettings`, save settings, and write profile-provider metadata.
- Break validations proven and reverted: created browser but skipped agent/state attachment; skipped `activeBrowserSettings` state write; resolved dynamic mode agents without current Harness state.
- Verification: focused browser command test, MastraCode typecheck, lint, and `pnpm run build:mastracode` all passed.

### Harness display state recovery checkpoint

Validated `Integrations: Harness display state` with a non-TUI subscriber rendering contract, committed as `b6b828aba5`:
- Extended `packages/core/src/harness/display-state.test.ts` to prove a UI consumer can render running/task/tool state from `subscribeDisplayState()` snapshots without subscribing to raw Harness events.
- Break validations proven and reverted: skipped display-state scheduler notifications; stopped tracking `tool_start`; stopped tracking `task_updated`.
- Verification: focused display-state tests, core typecheck, core lint, and `pnpm build:core` all passed.

### Skills command recovery checkpoint

Validated `Integrations: Skills command and workspace resolution` with direct slash-command regression shields, committed as `73952ec0ff`:
- Added `/skills` command coverage proving it eagerly resolves the dynamic workspace when `getResolvedWorkspace()` is initially undefined, lists only user-invocable skills, and does not leak `user-invocable: false` entries.
- Fixed `/goal/<skill>` aliases to resolve the dynamic workspace before the first message, matching `/skills` behavior, and added dispatcher coverage for that first-message path.
- Break validations proven and reverted: removed `/goal/<skill>` eager workspace resolution; disabled `/skills` eager workspace resolution; leaked non-user-invocable skills into `/skills`.
- Verification: focused skills/command-dispatch tests, MastraCode typecheck, lint, and `pnpm run build:mastracode` all passed.

### Lifecycle hooks recovery checkpoint

Validated `Integrations: Lifecycle hooks` with hook config and `/hooks` command shields, committed as `d06c80ab3c`:
- Added `mastracode/src/hooks/config.test.ts` proving global hooks run before project hooks, custom `configDir` paths are honored, invalid config entries are ignored, and `Notification` hooks load through the same config path as other lifecycle events.
- Added `mastracode/src/tui/commands/__tests__/hooks.test.ts` proving `/hooks` handles missing managers, reload, no-config guidance, configured paths, and `Notification` status rendering.
- Fixed config loading and status display to include `Notification` hooks.
- Break validations proven and reverted: removed `Notification` from config events; removed `Notification` from `/hooks` status events; reversed global/project merge order.
- Verification: focused hook config/command tests, MastraCode typecheck, lint, and `pnpm run build:mastracode` all passed.

### GitHub issue reporting recovery checkpoint

Validated `Integrations: GitHub issue reporting command` with direct command and dispatcher shields, committed as `bd8725f026`:
- Added `mastracode/src/tui/commands/__tests__/report-issue.test.ts` proving `/report-issue` gates on model selection, creates a pending thread before sending, and preserves prompt instructions for duplicate search, user approval, `mastracode` label, and `mastra-ai/mastra` repo.
- Tightened `mastracode/src/tui/__tests__/command-dispatch.test.ts` to prove `/report-issue` routes to the handler and removed `/fix-issue` remains absent.
- Break validations proven and reverted: removed model-selected gate; skipped pending-thread creation; reintroduced `/fix-issue` as an alias.
- Verification: focused report-issue/command-dispatch tests, MastraCode typecheck, lint, and `pnpm run build:mastracode` all passed.

### Observability feedback recovery checkpoint

Validated `Integrations: Observability and eval feedback` with a direct `/feedback` command shield, committed as `5040e7167e`:
- Added `mastracode/src/tui/commands/__tests__/feedback.test.ts` proving feedback requires active trace/run/thread context, records rating/comment payloads through observability `addFeedback`, preserves `correlationContext`, includes thread/run metadata, and enforces 0-10 numeric bounds.
- Break validations proven and reverted: removed the missing-context guard; dropped `correlationContext`; loosened numeric rating bounds.
- Verification: focused feedback command tests, MastraCode typecheck, lint, and `pnpm run build:mastracode` all passed.

### Plan approval rendering recovery checkpoint

Validated `Goals: Plan approval and build handoff` with inline plan rendering shields, committed as `eab201d3cc`:
- Extended `mastracode/src/tui/components/__tests__/plan-approval-inline.test.ts` to prove request-changes feedback mode keeps the submitted plan visible while the user types feedback.
- Added a narrow-terminal width assertion proving long markdown plan lines remain within the rendered component width.
- Break validations proven and reverted: removed plan content from feedback mode; bypassed inner-width wrapping/truncation; removed plan content from resolved requested-changes cards.
- Verification: focused plan-approval component tests, MastraCode typecheck, lint, and `pnpm run build:mastracode` all passed.

### Persistent goal status-line recovery checkpoint

Validated `Goals: Persistent /goal mode` with a narrow status-line fallback shield, committed as `e3773497de`:
- Fixed active goal judging status-line priority so OM progress and goal-duration labels do not displace the judge model on narrow terminals.
- Added a status-line regression test for active judge + active OM progress + active goal state + long model ID at 30 columns.
- Break validations proven and reverted: OM progress displaced the judge model; goal duration displaced the judge model; normal chat model replaced the judge model.
- Verification: `pnpm --filter ./mastracode exec vitest --run src/tui/__tests__/status-line.test.ts --reporter=dot`, `pnpm --filter ./mastracode check`, `pnpm --filter ./mastracode lint`, and `pnpm run build:mastracode` all passed.

### Subagent delegation recovery checkpoint

Validated `Subagents: Delegation to Explore / Plan / Execute` with a core harness abort-propagation shield, committed as `b201489b83`:
- Added behavior-level coverage for parent abort propagation into an active subagent stream, preserving partial output and ending the subagent as a non-error abort result.
- Break validations proven and reverted: missing `abortSignal` let the subagent complete with final output; missing post-stream abort check used final output; error-classified abort emitted `isError: true`.
- Verification: `pnpm --filter ./packages/core exec vitest --run src/harness/subagent-tool.test.ts --reporter=dot`, `pnpm --filter ./packages/core check`, `pnpm --filter ./packages/core lint`, and `pnpm build:core` all passed.

### Installation and launch recovery checkpoint

Validated `Setup: Installation and launch` with a static installed-package metadata shield, committed as `3b057f1ff1`:
- Added package metadata coverage for the installed CLI bin, public exports, package files, Node engine, and no floating `latest` dependency ranges.
- Break validations proven and reverted: source-file bin path failed; `latest` dependency failed via pnpm lockfile and direct Vitest assertion; bad `./tui` export failed.
- Verification: `pnpm --filter ./mastracode exec vitest --run src/__tests__/package-metadata.test.ts --reporter=dot`, `pnpm --filter ./mastracode check`, `pnpm --filter ./mastracode lint`, and `pnpm run build:mastracode` all passed.

### Auto-update prompts recovery checkpoint

Validated `Setup: Auto-update prompts` with direct `/update` command shields, committed as `267da3f245`:
- Added command-level coverage for non-fatal registry failure, already-latest messaging, changelog insertion, dismissed-version clearing/persistence, and failed auto-update manual command guidance.
- Break validations proven and reverted: missing changelog text failed; missing persisted clear of `updateDismissedVersion` failed; missing manual install command failed.
- Verification: `pnpm --filter ./mastracode exec vitest --run src/tui/commands/__tests__/update.test.ts --reporter=dot`, `pnpm --filter ./mastracode check`, `pnpm --filter ./mastracode lint`, and `pnpm run build:mastracode` all passed.

### Commit attribution recovery checkpoint

Validated `Git: Commit attribution` with prompt/dynamic-instructions shields:
- Added `prompts.test.ts` assertions for exact co-author footer formatting with and without selected model state.
- Added `instructions.test.ts` coverage that `getDynamicInstructions()` uses restored/current harness `currentModelId` in commit guidance.
- Break validations proven and reverted: missing model ID in footer, empty-parentheses fallback, and dropped `currentModelId` propagation.
- Verification: `pnpm --filter ./mastracode exec vitest --run src/agents/__tests__/prompts.test.ts src/agents/__tests__/instructions.test.ts --bail=1 --reporter=dot`, `pnpm --filter ./mastracode check`, `pnpm --filter ./mastracode lint`, and `pnpm run build:mastracode` all passed.

### Startup banner recovery checkpoint

Validated `TUI: Startup banner` with a layout-level startup header shield:
- Added `setup-layout.test.ts` for startup banner/frontmatter/hint/container/footer/focus composition in `buildLayout()`.
- Break validations proven and reverted: missing custom app name in banner rendering, missing worktree frontmatter, and stale mode-cycle hint for single-mode sessions.
- Verification: `pnpm --filter ./mastracode exec vitest --run src/tui/__tests__/setup-layout.test.ts --bail=1 --reporter=dot`, `pnpm --filter ./mastracode check`, `pnpm --filter ./mastracode lint`, and `pnpm run build:mastracode` all passed.

### Help and shortcuts recovery checkpoint

Validated `TUI: Help and shortcuts` with direct `/help` handler coverage and a product fix:
- Added `/help` command tests for mode-aware `/mode`/`⇧+Tab`, custom `//commands`, configured shell labels, current shortcut labels, `/api-keys`, `/observability`, and intentional `/feedback` omission.
- Fixed compact help drift by adding `/api-keys` to the command list and added a `mastracode` patch changeset.
- Break validations proven and reverted: removed `/api-keys`, forced single-mode help, and hardcoded default shell label.
- Verification: `pnpm --filter ./mastracode exec vitest --run src/tui/commands/__tests__/help.test.ts src/tui/components/__tests__/help-overlay.test.ts --bail=1 --reporter=dot`, `pnpm --filter ./mastracode check`, `pnpm --filter ./mastracode lint`, and `pnpm run build:mastracode` all passed.

### Process suspend shortcut recovery checkpoint

Validated `TUI: Process suspend shortcut` with direct tests for the Ctrl+Z/Alt+Z contract:
- `mastracode/src/tui/components/__tests__/custom-editor.test.ts` now proves Ctrl+Z dispatches `suspend`, Alt+Z dispatches `undo`, and both shortcuts avoid base-editor fallthrough.
- `mastracode/src/tui/__tests__/setup-keyboard-shortcuts.test.ts` now proves the suspend lifecycle (`ui.stop()`, `SIGCONT`, `SIGTSTP`, resume render), Windows guard, failure recovery, and Alt+Z undo-last-clear behavior.
- Break validations were proven and reverted for wrong Ctrl+Z routing, missing `SIGCONT` registration, and missing Windows guard.
- Verification passed: focused shortcut/editor tests, `pnpm --filter ./mastracode check`, `pnpm --filter ./mastracode lint`, and `pnpm run build:mastracode`.

### File autocomplete recovery checkpoint

Validated `TUI: File autocomplete` with setup-level provider wiring coverage:
- Extended `mastracode/src/tui/__tests__/setup-keyboard-shortcuts.test.ts` so the `CombinedAutocompleteProvider` mock records commands, cwd, and `fdPath`.
- Added tests for detected `fd`, fallback to `fdfind`, missing-binary graceful fallback, `process.cwd()` propagation, and slash/custom command preservation when file search is unavailable.
- Break validations proven and reverted: omitted `fdPath` from the provider; removed `fdfind` fallback; rethrew missing-binary detection failures.
- Verification: focused setup autocomplete tests, MastraCode typecheck, lint, and `pnpm run build:mastracode` all passed.

### Terminal theme recovery checkpoint

Validated `TUI: Terminal theme and contrast` with direct `/theme` command coverage:
- Added `mastracode/src/tui/commands/__tests__/theme.test.ts` covering current-theme display, explicit dark preference persistence, immediate `applyThemeMode()`, auto terminal detection with detected background propagation, render refresh, and invalid-value rejection.
- Break validations proven and reverted: skipped `saveSettings()` for changed preference; omitted detected background from auto apply; skipped `requestRender()` after applying a new theme.
- Verification: focused theme command tests, MastraCode typecheck, lint, and `pnpm run build:mastracode` all passed.

### Shell passthrough recovery checkpoint

Validated `TUI: Shell passthrough streaming` with component-level output rendering coverage:
- Added `mastracode/src/tui/components/__tests__/shell-output.test.ts` covering incremental output rendering, trailing partial-line flush on finish, non-zero failure footer, 20-line collapsed view, 200-line cap, expanded view, and terminal-width truncation.
- Break validations proven and reverted: dropped partial-line flush on finish; changed collapsed view from 20 lines; removed non-zero exit-code footer.
- Verification: focused shell-output tests, MastraCode typecheck, lint, and `pnpm run build:mastracode` all passed.

## 2026-06-06 — Debug logging recovery checkpoint

Validated `TUI: Debug logging` with commit `406e2a214e`.

Evidence:
- Added repeated-session coverage in `mastracode/src/utils/__tests__/debug-log.test.ts` proving oversized logs truncate below the cap and later debug setup calls append warning/error output without partial-line corruption.
- Proved 3 breaks fail and reverted them: no truncation, write-mode log stream, and missing warning redirection.
- Verification passed: `pnpm --filter ./mastracode exec vitest --run src/utils/__tests__/debug-log.test.ts --bail=1 --reporter=dot`, `pnpm --filter ./mastracode check`, `pnpm --filter ./mastracode lint`, and `pnpm run build:mastracode`.

## 2026-06-06 — Web search rendering recovery checkpoint

Validated `Tools: Web search tool rendering` with commit `53eae54a9c`.

Evidence:
- Added normal-mode TUI renderer coverage for Anthropic web-search arrays (`pageAge`, title/URL rows, encrypted-content stripping), OpenAI `{ action, sources }` result objects (source rows and fallback query extraction), and Tavily markdown passthrough.
- Proved 3 breaks fail and reverted them: missing `pageAge`, missing OpenAI action-query fallback, and JSON double-formatting Tavily markdown.
- Verification passed: `pnpm --filter ./mastracode exec vitest --run src/tui/components/__tests__/tool-execution-enhanced.test.ts --bail=1 --reporter=dot`, `pnpm --filter ./mastracode check`, `pnpm --filter ./mastracode lint`, and `pnpm run build:mastracode`.

## 2026-06-06 — Recovery tracker exhausted

The Mastra Code testing recovery queue is exhausted.

Final tracker audit:
- Feature-map rows requiring recovery: 56.
- Tracker rows: 56.
- Missing feature-map rows from tracker: 0.
- Unfinished tracker rows: 0.
- Validated tracker rows: 56.
- Deferred rows: 0.

Final verification passed:
- `pnpm run build:mastracode` — 24/24 tasks successful.
- `pnpm --filter ./mastracode check` — clean.
- `pnpm --filter ./mastracode lint` — clean.
- `env -u OPENAI_API_KEY -u OPENAI_BASE_URL -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL -u TAVILY_API_KEY pnpm --filter ./mastracode exec vitest --run --bail=1 --reporter=dot` — 128 files / 1300 tests passed.

All recovery work is committed and pushed on `tests/mc`; the remaining action is user final approval.

## 2026-06-06 — E2E coverage correction

The final recovery approval request was rejected because the completed queue relied almost entirely on focused unit/integration/component/headless shields. Only the original three checked-in TUI e2e scenarios existed (`startup`, `branch-context-long-name`, `automated-chat`), and only `branch-context-long-name` was strengthened during recovery.

Correction:
- Reopened all 56 tracker rows as `needs-follow-up`.
- Added a `TUI e2e status` column and marked every row missing checked-in scenario coverage.
- Updated recovery instructions to require TUI e2e for TUI-visible, TUI-triggered, or terminal-user-observable behavior before a row can be marked `validated`.
- Preserved existing focused-test evidence as supporting shields, not completion evidence.
- Added fixture guidance: real-world conversations and observational-memory data may be read from the local Mastra Code Application Support database only with read-only operations, then sanitized and transformed into deterministic AIMock-compatible fixtures. Tests must never mutate or depend on the live local DB.

Next action: begin adding the missing `mastracode/scripts/mc-e2e/scenarios/` coverage, starting with high-value TUI-visible flows and reusing AIMock fixtures where LLM behavior is involved.

## 2026-06-06 — First reopened TUI e2e batch

Added the first missing checked-in TUI e2e scenarios after reopening the tracker:
- `visible-commands` covers real PTY `/help` and `/theme` command feedback. It validates baseline help command/shortcut text, `/api-keys`, Ctrl+Z guidance, `/theme` status, and invalid theme usage text.
- `integration-commands` covers real PTY `/browser status` and `/mcp status` visible command surfaces. This is partial coverage only; full browser attach and configured MCP manager/reload flows still need e2e.
- `report-issue-command` covers real PTY `/report-issue startup hangs` with AIMock-backed model response and request-count proof.

Tracker state after this batch:
- 56 total rows.
- 3 rows validated with covered TUI e2e (`Help and shortcuts`, `Terminal theme and contrast`, `GitHub issue reporting command`).
- 2 rows have partial TUI e2e (`Browser automation`, `MCP status and reload command`) and remain `needs-follow-up`.
- 51 rows still have missing TUI e2e.

Verification:
- `pnpm --filter ./mastracode run e2e:test visible-commands` passed.
- `pnpm --filter ./mastracode run e2e:test integration-commands` passed.
- `pnpm --filter ./mastracode run e2e:test report-issue-command` passed with AIMock request count 1.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 6/6 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

## 2026-06-06 — Workspace/lifecycle TUI e2e batch

Added `workspace-commands` checked-in TUI e2e scenario:
- Covers real PTY `/skills` visible fallback/list surface before any message has resolved workspace.
- Covers real PTY `/hooks` visible fallback/status surface with hooks disabled in the hermetic e2e environment.

Tracker state after this batch:
- 56 total rows.
- 3 rows validated with covered TUI e2e.
- 4 rows have partial TUI e2e and remain `needs-follow-up`.
- 49 rows still have missing TUI e2e.

Verification:
- `pnpm --filter ./mastracode run e2e:test workspace-commands` passed.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 7/7 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

## 2026-06-06 — Startup/state command TUI e2e batch

Added/strengthened checked-in TUI e2e coverage:
- Strengthened `startup` to assert real startup frontmatter: project, resource ID, branch, and user.
- Added `state-commands` to cover `/mode`, `/think status`, `/permissions`, `/yolo`, `/cost`, `/resource` status/switch/reset, `/sandbox add` error, `/observability local`, and `/feedback up` no-session feedback in a real PTY.

Rows revalidated with checked-in e2e coverage:
- Startup performance
- Startup banner
- Interactive chat (existing `automated-chat`)
- Branch context and status (existing `branch-context-long-name`)
- Resource ID switching
- Model auth, selection, modes
- Thinking and reasoning effort
- Coding tools and approval permissions
- Observability and eval feedback

Break validation:
- Removed `Resource ID` startup frontmatter -> `startup` failed waiting for `/Resource ID:/`.
- Changed `/permissions` heading -> `state-commands` failed waiting for `Tool Approval Permissions`.
- Changed `/observability local` status text -> `state-commands` failed waiting for `Local DuckDB tracing is currently`.
- Changed `/feedback` no-session error -> `state-commands` failed waiting for `No active session to attach feedback to`.
- All intentional breaks were reverted before committing.

Verification:
- `pnpm --filter ./mastracode run e2e:test startup` passed.
- `pnpm --filter ./mastracode run e2e:test state-commands` passed.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 8/8 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

## 2026-06-06 — Headless prompt TUI deferral

Validated `Headless: Prompt mode` with explicit TUI-e2e not-applicable rationale:
- The feature is the non-interactive CLI/headless path and bypasses TUI construction by design.
- Existing headless unit/integration tests cover parsing, stdin pipe handling, output formats, thread/resource controls, and model/mode preflight.
- Existing break evidence remains: text output buffering, JSON summary, and stream-json NDJSON contracts fail when broken.
- Adjacent startup/TUI fallback behavior remains covered by checked-in TUI e2e scenarios.

## 2026-06-06 — Modal/shell TUI e2e partial coverage batch

Added `modal-and-shell` checked-in TUI e2e scenario:
- Opens `/sandbox` through a real PTY, asserts the configuration modal question/action text, cancels with Escape, and verifies the normal editor returns.
- Submits a real default-shell `!printf` passthrough command, asserts bordered stdout is rendered as shell output, and asserts the completed success footer.

Rows moved from missing e2e to partial e2e:
- TUI: Configuration modal overlays — partial only; broader `/setup` nested model-selector Escape/back navigation remains missing.
- TUI: Shell passthrough streaming — partial only; configured shell modes and long-running stream-before-exit coverage remain missing.

Break validation:
- Changed `/sandbox` modal action label from `Add path` -> `modal-and-shell` failed waiting for the real modal action text.
- Stopped appending stdout chunks to the shell component -> `modal-and-shell` failed waiting for the bordered stdout line.
- Removed the shell success `✓` footer -> `modal-and-shell` failed waiting for the completed shell footer.
- All intentional breaks were reverted before committing.

Verification:
- `pnpm --filter ./mastracode run e2e:test modal-and-shell` passed.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 9/9 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

## 2026-06-06 — API-key masked prompt TUI e2e partial coverage batch

Added `api-key-prompt` checked-in TUI e2e scenario:
- Opens `/api-keys` through a real PTY and verifies the provider status list.
- Selects an unset provider, opens the API-key modal dialog, types a fake key, asserts the secret is not rendered, and asserts mask characters are visible.
- Submits the dialog and verifies the provider status refreshes to stored.

Rows moved from missing e2e to partial e2e:
- TUI: Interactive prompts and access requests — partial only; ask_user multiline/custom/multi-select queueing and request_access approval flows remain missing.
- Settings: Onboarding and global settings — partial only; first-run `/setup`, `/models`, OM/global defaults, and reload behavior remain missing.

Break validation:
- Rendered MaskedInput cleartext -> `api-key-prompt` failed because the serialized terminal contained the fake secret.
- Skipped opening the API-key dialog on provider select -> `api-key-prompt` failed waiting for `API Key Required`.
- Skipped stored-key persistence -> `api-key-prompt` failed waiting for the provider to become stored.
- All intentional breaks were reverted before committing.

Verification:
- `pnpm --filter ./mastracode run e2e:test api-key-prompt` passed.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 10/10 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

## 2026-06-06 — Storage settings TUI e2e partial coverage batch

Added `storage-settings` checked-in TUI e2e scenario:
- Opens `/settings` through a real PTY and navigates to the Storage backend row.
- Opens the backend picker, selects PostgreSQL, and verifies the connection-string prompt.
- Types a fake PostgreSQL connection string, asserts the secret is masked rather than rendered cleartext, submits it, and verifies the restart-required notice.

Rows moved from missing e2e to partial e2e:
- Settings: Storage backend configuration — partial only; persisted reload, selected-backend-after-restart, real PostgreSQL/PgVector integration, and migration behavior remain missing.

Break validation:
- Renamed the visible `Storage backend` settings label -> `storage-settings` failed waiting for the real label.
- Rendered masked input cleartext -> `storage-settings` failed because the serialized terminal exposed the fake connection string instead of mask characters.
- Skipped the PostgreSQL connection-input transition -> `storage-settings` failed waiting for `PostgreSQL Connection`.
- All intentional breaks were reverted before committing.

Verification:
- `pnpm --filter ./mastracode run e2e:test storage-settings` passed.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 11/11 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

## 2026-06-06 — Thread history TUI e2e coverage batch

Added `thread-history` checked-in TUI e2e scenario:
- Adds a per-scenario `prepare` hook to seed isolated e2e storage before Mastra Code launches.
- Seeds a scrubbed synthetic thread and user+assistant messages shaped from read-only inspection of the local Mastra Code DB schema.
- Opens `/threads` through a real PTY, selects the seeded cross-resource thread, and verifies the loaded user and assistant history render after switching.

Rows moved from missing e2e to covered e2e:
- Threads: Persistent conversations / switching — covered for persisted thread selector visibility, cross-resource thread switch, and loaded history rendering. Deeper restart-after-streamed-tools/tasks and lock-prompt process conflict coverage remain listed as follow-up risks, but the core TUI persistence path now has checked-in e2e coverage.

Break validation:
- Disabled scenario DB preparation -> `thread-history` failed because no persisted thread was listed.
- Changed `/threads` to list only the current resource -> `thread-history` failed because the seeded cross-resource thread disappeared.
- Suppressed assistant text rendering from loaded history -> `thread-history` failed waiting for the recovered assistant message.
- All intentional breaks were reverted before committing.

Verification:
- `pnpm --filter ./mastracode run e2e:test thread-history` passed.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 12/12 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

## 2026-06-06 — OM settings TUI e2e partial coverage batch

Added `om-settings` checked-in TUI e2e scenario:
- Opens `/om` through a real PTY and verifies the Observational Memory settings overlay rows.
- Enters the Caveman observations submenu, verifies the On/Off explanations, toggles Caveman observations on, closes and reopens `/om`, and verifies the On value is restored from runtime thread state.

Rows moved from missing e2e to partial e2e:
- Memory: Observational memory — partial only; this covers the user-visible `/om` settings overlay and Caveman runtime-state restoration, but background observation/reflection, recall/source-message provenance, resource/thread scope isolation, and loaded-history OM markers remain missing.

Break validation:
- Renamed the OM overlay title -> `om-settings` failed waiting for `Observational Memory Settings`.
- Skipped Caveman runtime state persistence -> `om-settings` failed after closing/reopening `/om`.
- Hid the `Observe attachments` row -> `om-settings` failed waiting for that user-visible row.
- All intentional breaks were reverted before committing.

Verification:
- `pnpm --filter ./mastracode run e2e:test om-settings` passed.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 13/13 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

## 2026-06-06 — Clipboard image paste TUI e2e batch

Added `clipboard-image-paste` checked-in TUI e2e scenario:
- Creates a tiny deterministic PNG under the isolated e2e temp area.
- Bracketed-pastes the PNG path through the real PTY editor.
- Verifies `[image]` appears in the editor, submits the prompt, verifies confirmed history renders `[1 image] Please inspect the pasted image`, and receives `MC clipboard image paste response` from AIMock with a nonzero request count.

Rows updated:
- TUI: Clipboard paste — validated with covered TUI e2e.
- Chat: File attachments in chat input — moved from missing to partial e2e because the pasted-image path now proves a real TUI attachment submit, but reload/history persistence, text/binary file attachments, and OM observation remain missing.

Break validation:
- Removed `[image]` placeholder insertion in `MastraTUI.onImagePaste` -> `clipboard-image-paste` failed waiting for `[image]`.
- Removed confirmed history image-count rendering -> `clipboard-image-paste` failed waiting for `[1 image] Please inspect the pasted image`.
- Dropped consumed image attachments in `consumePendingImages()` -> `clipboard-image-paste` failed waiting for confirmed `[1 image]` rendering.
- All intentional breaks were reverted before committing.

Verification:
- `pnpm --filter ./mastracode run e2e:test clipboard-image-paste` passed with 1 AIMock request.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 14/14 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

## 2026-06-06 — Quiet settings TUI e2e partial coverage batch

Added `quiet-settings` checked-in TUI e2e scenario:
- Seeds isolated settings so Quiet mode starts off with a deterministic 2-line preview cap.
- Opens `/settings` through a real PTY, toggles Quiet mode on, closes/reopens settings to verify the persisted On value, changes preview lines from 2 to 4, and closes/reopens again to verify preview-line persistence.

Rows moved from missing e2e to partial e2e:
- TUI: Quiet mode — partial only; this covers the user-visible `/settings` persistence path, but live compact tool/subagent rendering, Ctrl+E expansion, task summaries, and loaded-history parity remain missing.

Break validation:
- Renamed the Quiet mode settings row -> `quiet-settings` failed waiting for `Quiet mode Off`.
- Skipped Quiet mode persistence -> `quiet-settings` failed after closing/reopening `/settings`.
- Skipped preview-line persistence -> `quiet-settings` failed after the final close/reopen check.
- All intentional breaks were reverted before committing.

Verification:
- `pnpm --filter ./mastracode run e2e:test quiet-settings` passed.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 15/15 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

## 2026-06-06 — File autocomplete TUI e2e batch

Added `file-autocomplete` checked-in TUI e2e scenario:
- Seeds an isolated git fixture project with `src/autocomplete-target.ts` and a deterministic fake `fd` binary on PATH.
- Types `Attach @auto` through the real PTY editor, verifies the fixture file suggestion is visible, presses Tab, and verifies `Attach @src/autocomplete-target.ts` is inserted in the editor.
- Adds a narrow runner `env` hook so scenarios can safely provide deterministic binaries/env without depending on the host machine.

Rows moved from missing e2e to covered e2e:
- TUI: File autocomplete — validated for real terminal `@` file suggestion visibility and insertion. Focused setup tests remain supporting coverage for slash/custom/skill command preservation, fdfind fallback, missing-binary fallback, cwd propagation, and fdPath propagation.

Break validation:
- Dropped `fdPath` from `CombinedAutocompleteProvider` -> `file-autocomplete` failed waiting for `autocomplete-target.ts`.
- Skipped `editor.setAutocompleteProvider(...)` -> `file-autocomplete` failed waiting for suggestions.
- Made fd detection miss the available binary -> `file-autocomplete` failed waiting for suggestions.
- All intentional breaks were reverted before committing.

Verification:
- `pnpm --filter ./mastracode run e2e:test file-autocomplete` passed.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 16/16 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

## 2026-06-06 — Custom configDir embedded TUI e2e batch

Added `custom-config-dir` checked-in TUI e2e scenario:
- Seeds an isolated project with `.acme-code` command/skill fixtures plus `.mastracode` decoys.
- Launches a custom embedded TUI entrypoint that calls `createMastraCode({ configDir: '.acme-code' })`, matching the programmatic API surface rather than inventing a CLI flag.
- Verifies `/help` lists the `.acme-code` custom command and does not list the `.mastracode` decoy.
- Verifies `/skills` lists the `.acme-code` skill and does not list the `.mastracode` decoy.
- Adds a narrow e2e runner `entrypoint` hook so scenarios can launch embedded Mastra Code entrypoints when the feature has no CLI/TUI flag.

Rows moved from missing e2e to covered e2e:
- Settings: Custom config directory — validated for programmatic configDir affecting TUI-visible custom commands and workspace skills. Existing startup shields remain supporting coverage for storage, MCP, hooks, resource-id lookup, and runtime Harness state alignment.

Product fix:
- `loadCustomSlashCommands()` now reads `state.harness.getState()?.configDir` and passes it to `loadCustomCommands()` for global and project command loading, so TUI custom slash command discovery stays aligned with the configured runtime directory.

Break validation:
- Ignored `configDir` while loading TUI custom commands -> `custom-config-dir` failed because `/help` showed `//default-only` and missed `//acme`.
- Ignored `state.configDir` while building workspace skill paths -> `custom-config-dir` failed because `/skills` loaded `default-skill` instead of `acme-skill`.
- Ignored the scenario embedded entrypoint in the e2e runner -> `custom-config-dir` launched the default CLI and loaded `.mastracode` instead of `.acme-code`.
- All intentional breaks were reverted before committing.

Verification:
- `pnpm --filter ./mastracode run e2e:test custom-config-dir` passed.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 17/17 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

## 2026-06-06 — Prompt context instructions TUI e2e batch

Added `prompt-context-instructions` checked-in TUI e2e scenario:
- Seeds an isolated git fixture with `AGENTS.md`, same-location `CLAUDE.md`, and singular `AGENT.md`.
- Sends `Confirm the active project instruction phrase.` through the real TUI with AIMock.
- Extends the e2e runner with `verifyAimockRequests()` so scenarios can inspect captured AIMock request bodies, not only visible assistant output.
- Verifies the actual model request contains the winning `AGENTS.md` instruction phrase and excludes the fallback `CLAUDE.md` and singular `AGENT.md` phrases.

Rows moved from missing e2e to covered e2e:
- Chat: Prompt context and project instructions — validated for active TUI prompt construction and static project instruction precedence/exclusion in the real model request.

Break validation:
- Swapped `CLAUDE.md` ahead of `AGENTS.md` -> TUI still showed the mocked response, but AIMock request verification failed because the AGENTS phrase was absent.
- Removed project-root instruction discovery -> AIMock request verification failed because the AGENTS phrase was absent.
- Dropped `formatAgentInstructions()` output -> AIMock request verification failed because loaded instructions were not injected into the request.
- All intentional breaks were reverted before committing.

Verification:
- `pnpm --filter ./mastracode run e2e:test prompt-context-instructions` passed with 1 AIMock request.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 18/18 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

## 2026-06-06 — Custom slash command TUI e2e batch

Added `custom-slash-command` checked-in TUI e2e scenario:
- Seeds project `.mastracode/commands/deploy.md` with no arg placeholders and `.mastracode/commands/review.md` with `$1+`.
- Submits `//deploy prod blue` and `//review src/index.ts src/main.ts` through the real TUI.
- Uses AIMock fixtures for the processed model-facing messages and verifies captured requests include `ARGUMENTS: prod blue` plus the full `$1+` range args without duplicate raw-arg append.

Rows updated:
- Chat: Queued follow-ups and slash commands — moved from missing e2e to partial e2e. This covers custom command loading/dispatch and argument preservation, but active-run Ctrl+F explicit queueing, FIFO mixed drain, queued-count status, and autocomplete acceptance remain missing.

Break validation:
- Forced `shouldAppendRawArgs: false` -> deploy command displayed without `ARGUMENTS` and failed AIMock fixture matching.
- Made `$1+` consume only the first arg -> review command displayed only `src/index.ts` and failed fixture matching.
- Skipped local custom-command loading -> real TUI returned `Unknown custom command: deploy` and AIMock saw zero requests.
- All intentional breaks were reverted before committing.

Verification:
- `pnpm --filter ./mastracode run e2e:test custom-slash-command` passed with 2 AIMock requests.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 19/19 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

## 2026-06-06 — Active signal follow-up TUI e2e batch

Added `active-signal-followup` checked-in TUI e2e scenario:
- Starts an AIMock-backed streaming run with chunk pacing.
- Submits `Steer while active.` through the real TUI before the initial response completes.
- Asserts the pending interjection UI (`↳ Steer while active. pending…`) appears.
- Waits for both the initial and follow-up AIMock responses.
- Verifies captured AIMock request bodies include `<user delivery="message">Start a slow active signal run.</user>` and `<user delivery="while-active">Steer while active.</user>`.

Rows moved from missing e2e to covered e2e:
- Chat: Agent signals and streaming follow-ups — validated for Mastra Code TUI active-run signal follow-ups.

Break validation:
- Changed active signal delivery from `while-active` to `message` -> TUI still completed, but AIMock request verification failed.
- Routed active Enter through the old queued follow-up path -> scenario showed normal user boxes plus `2 queued`, no pending signal interjection, and zero AIMock requests.
- Removed pending interjection projection -> model requests still completed, but `↳ … pending…` never appeared.
- All intentional breaks were reverted before committing.

Verification:
- `pnpm --filter ./mastracode run e2e:test active-signal-followup` passed with 2 AIMock requests.
- `pnpm --filter ./mastracode run e2e:test -- --jobs 2` passed: 20/20 scenarios.
- `pnpm --filter ./mastracode check` passed.
- `pnpm --filter ./mastracode lint` passed.
- `pnpm run build:mastracode` passed.

### E2E correction follow-up: processor state signal partial coverage

Added `state-signal-rendering` as a checked-in PTY scenario. It launches Mastra Code through a custom entrypoint, emits `agent.sendStateSignal()` into the active thread, asserts the TUI renders `State snapshot: browser` plus the state preview, and verifies AIMock captured the state contents in the model request body. Three break checks were proven and reverted: removing inline state-signal rendering, dropping the state preview payload, and changing the visible state-signal title.

This moves `Chat: Processor state signals` from `missing e2e` to `partial e2e`. It does not close the row because live browser-processor snapshot/delta reload/history parity and long-session pruning still need dedicated coverage.

### E2E correction follow-up: notification signal partial coverage

Added `notification-signal-rendering` as a checked-in PTY scenario. It launches Mastra Code through a custom entrypoint, emits `agent.sendNotificationSignal()` into the active thread, asserts the TUI renders a `notification from github` card with priority/kind/status details and alert body, and verifies AIMock captured the notification contents in the model request body. Three break checks were proven and reverted: changing the notification source title, dropping the delivered-status detail, and removing the notification message body.

This moves `Chat: Notification inbox signals` from `missing e2e` to `partial e2e`. It does not close the row because model-driven `notification_inbox read`, summary batching, CRUD status transitions, and persistence/reload coverage still need dedicated scenarios.

### 2026-06-06 — GitHub Signals command e2e partial coverage

Added `mastracode/scripts/mc-e2e/scenarios/github-signals-command.ts` as a deterministic real PTY scenario for the GitHub Signals command surface. The scenario enables `experimentalGithubSignals` in the isolated app-data settings file, launches an embedded Mastra Code TUI with a current thread, runs `/github debug`, and asserts the visible `GitHub Signals debug for ... no subscribed PRs` empty-subscription status.

Break validation proved the scenario fails when `/github debug` routing is changed, when the no-subscriptions debug copy changes, and when the experimental setting guard rejects enabled GitHub Signals. The row remains `needs-follow-up`/partial because it does not yet cover live subscribe/sync/polling against gitcrawl/GitHub data, notification inbox delivery, branch auto-subscribe, or reload parity.

### 2026-06-06 — Custom provider management e2e partial coverage

Added `mastracode/scripts/mc-e2e/scenarios/custom-provider-management.ts` as a real PTY scenario for `/custom-providers`. The scenario seeds a scrubbed OpenAI-compatible provider in isolated settings, verifies the provider row shows URL/model-count/API-key status, selects the provider, opens the manage-provider modal, adds `__AI_SDK_OPENAI_MODEL_REALTIME__`, and reopens `/custom-providers` to prove the model count persisted.

Break validation proved the scenario fails when `/custom-providers` dispatch is broken, when provider model-count/status copy changes, and when add-model stops saving settings. The row remains `needs-follow-up`/partial because create/edit/delete provider validation, remove-model, `/models` selection, `/om` selector persistence, and live custom-provider request routing still need e2e coverage.

### 2026-06-07 — OpenAI strict schema TUI e2e coverage

- Added `mastracode/scripts/mc-e2e/scenarios/openai-strict-schema.ts` and `mastracode/scripts/mc-e2e/fixtures/openai-strict-schema.json`.
- Scenario launches an embedded Mastra Code TUI with an e2e-only `strict_schema_probe` tool containing optional top-level and nested Zod fields, submits a real PTY prompt through OpenAI AIMock, and verifies the final provider request requires every tool-schema property and sets `additionalProperties: false` recursively.
- Break validations proven after rebuilding core artifacts with `pnpm build:core`:
  1. Dropping prepared tool parameters in `packages/core/src/stream/aisdk/v5/compat/prepare-tools.ts` made `openai-strict-schema` fail request verification because required properties were absent.
  2. Forcing top-level prepared tool `additionalProperties: true` made the scenario fail with expected strict top-level `additionalProperties: false`.
  3. Forcing nested prepared tool `additionalProperties: true` made the scenario fail with expected nested `additionalProperties: false`.
- Final focused verification: `pnpm --filter ./mastracode run e2e:test openai-strict-schema`.
- Tracker row `Models: OpenAI strict schema compatibility` updated from missing e2e to validated/covered; broader verification and commit are pending in this batch.


### 2026-06-07 — Tool schema compatibility TUI e2e coverage

- Added `mastracode/scripts/mc-e2e/scenarios/tool-schema-compat.ts` and `mastracode/scripts/mc-e2e/fixtures/tool-schema-compat.json`.
- Scenario submits a real PTY Mastra Code prompt through OpenAI AIMock and verifies the provider request includes usable built-in command tool schemas for `ask_user`, `task_write`, and `submit_plan`.
- Request verification asserts object schemas, `ask_user.question`, `submit_plan.plan`, and nested `task_write.tasks.items.properties` for `content`, `status`, and `activeForm`.
- Break validations proven after rebuilding core artifacts with `pnpm build:core`:
  1. Replacing prepared tool schemas with empty object schemas made `tool-schema-compat` fail because `ask_user.question` was absent.
  2. Renaming prepared built-in tools made `tool-schema-compat` fail because `ask_user` could not be found in the provider request.
  3. Stripping nested array item properties made `tool-schema-compat` fail because `task_write` task item fields were absent.
- Final focused verification: `pnpm build:core` and `pnpm --filter ./mastracode run e2e:test tool-schema-compat`.
- Tracker row `Models: Tool schema compatibility` moved from `needs-follow-up`/missing e2e to `validated`/covered e2e. Packaging-level CLI zod dependency coverage remains listed as a separate missing test in the feature card.

### 2026-06-07 — Provider history compatibility TUI e2e partial coverage

- Added `mastracode/scripts/mc-e2e/scenarios/provider-history-compat.ts` and `mastracode/scripts/mc-e2e/fixtures/provider-history-compat.json`.
- Scenario seeds a scrubbed persisted thread on the active Mastra Code resource, switches to it through `/threads`, routes `cerebras/gpt-5.4-mini` through an AIMock-backed OpenAI-compatible custom provider named `cerebras`, submits a real PTY follow-up prompt, and verifies the outbound provider request preserves assistant text history while no seeded reasoning sentinel leaks into the request body.
- Break validations proven and reverted:
  1. Disabling custom-provider routing in `mastracode/src/agents/model.ts` made the scenario hit the real Cerebras endpoint and fail auth instead of AIMock.
  2. Changing `/threads` switch feedback from `Switched to:` to different copy made the scenario fail before the follow-up prompt.
  3. Dropping assistant text accumulation in loaded-history rendering made the scenario fail waiting for the seeded assistant answer.
- Focused verification: `pnpm --filter ./mastracode run e2e:test provider-history-compat`.
- Tracker row `Models: Provider history compatibility` moved from missing e2e to partial e2e. It remains `needs-follow-up` because persisted-history loading normalizes the seeded reasoning before the TUI request reaches `ProviderHistoryCompat`; direct proof that the processor strips post-conversion reasoning remains covered by core tests until a TUI/headless provider-rejection fixture can exercise the exact processor rule.

### 2026-06-07 — Stream error retry TUI e2e partial coverage

- Added `mastracode/scripts/mc-e2e/scenarios/stream-error-retry.ts` and `mastracode/scripts/mc-e2e/fixtures/stream-error-retry.json`.
- Scenario launches an embedded Mastra Code TUI, monkeypatches the first `/chat/completions` fetch to return a retryable stream-event error chunk, then allows the retry to reach AIMock and asserts the real TUI renders `Recovered after retryable stream error.`
- Focused verification: `pnpm --filter ./mastracode run e2e:test stream-error-retry`.
- Tracker row `Models: Stream error retry processor` moved from missing e2e to partial e2e. It remains `needs-follow-up` because removing `StreamErrorRetryProcessor` from Mastra Code did not make this scenario fail: the provider SDK also retries the injected stream-event shape internally. The existing focused tests still directly prove processor wiring/order and matcher behavior; a future e2e needs a provider failure shape that bypasses SDK retry and exercises Mastra's processor specifically.

### 2026-06-07 — Workspace tool aliases TUI e2e partial coverage

- Added `mastracode/scripts/mc-e2e/scenarios/workspace-tool-names.ts` and `mastracode/scripts/mc-e2e/fixtures/workspace-tool-names.json`.
- Scenario submits a real PTY Mastra Code prompt through OpenAI AIMock and verifies the provider-visible tool dictionary exposes stable Mastra Code workspace aliases (`view`, `find_files`, `search_content`, `execute_command`, `lsp_inspect`) while hiding old `mastra_workspace_*` IDs.
- Break validations proven and reverted:
  1. Removing the `view` name override made `mastra_workspace_read_file` leak and request verification failed.
  2. Removing the `lsp_inspect` name override made `mastra_workspace_lsp_inspect` leak and request verification failed.
  3. Removing the `execute_command` name override made `mastra_workspace_execute_command` leak and request verification failed.
- Focused verification: `pnpm --filter ./mastracode run e2e:test workspace-tool-names`.
- Tracker row `Tools: Workspace-backed coding tools` moved from missing e2e to partial e2e. Broader workspace behavior still needs plan-mode write disabling, loaded-history tool rendering, workspace reuse/allowed-path refresh, subagent inheritance, and real LSP smoke scenarios.

### 2026-06-07 — Streaming tool arguments TUI e2e partial coverage

- Added `mastracode/scripts/mc-e2e/scenarios/streaming-tool-args.ts`.
- Scenario launches an embedded Mastra Code TUI and emits real Harness `tool_input_start`, delayed `tool_input_delta`, `tool_input_end`, `tool_start`, and `tool_end` events from a custom entrypoint.
- The PTY test asserts partial `view src/streaming-args.ts` args render before the final range appears, then asserts final `tool_start`/`tool_end` replacement renders `src/streaming-args.ts:12-18` and the result text.
- Break validations proven and reverted:
  1. Skipping `tool_input_delta` dispatch made the scenario fail because partial streamed args never rendered before final args.
  2. Parsing only the latest delta fragment instead of the canonical Harness display-state buffer made the scenario fail the partial-render assertion.
  3. Suppressing `offset`/`limit` range rendering made the scenario fail waiting for `src/streaming-args.ts:12-18`.
- Focused verification: `pnpm --filter ./mastracode run e2e:test streaming-tool-args`.
- Tracker row `Tools: Streaming tool arguments` moved from missing e2e to partial e2e. It remains `needs-follow-up` because task-tool pre-text preservation and loaded-history/circular-result parity still need checked-in e2e coverage.

### 2026-06-07 — Task tracking TUI e2e partial coverage

- Added `mastracode/scripts/mc-e2e/scenarios/task-progress-events.ts`.
- Scenario launches an embedded Mastra Code TUI and emits real Harness `task_write` input-streaming plus `task_updated` events from a custom entrypoint.
- The PTY test asserts streamed task input updates pinned progress to `Tasks [0/2 completed]`, a later `task_updated` event moves pinned progress to `Tasks [1/2 completed]`, and final all-completed state renders inline `Tasks [2/2 completed]` history.
- Break validations proven and reverted:
  1. Disabling the `task_write` partial-args branch in `handleToolInputDelta()` made the scenario fail waiting for streamed `[0/2]` pinned progress.
  2. Disabling `task_updated` pinned `TaskProgressComponent.updateTasks()` made the scenario fail waiting for `[1/2]` active progress.
  3. Skipping completed inline task rendering made the scenario fail waiting for `[2/2]` completed history.
- Focused verification: `pnpm --filter ./mastracode run e2e:test task-progress-events`.
- Tracker row `Tools: Task tracking tools and TUI progress` moved from missing e2e to partial e2e. It remains `needs-follow-up` because prompt-context agreement and reload/history reconstruction still need checked-in e2e coverage.

### 2026-06-07 — MCP server configuration TUI e2e partial coverage

- Added `mastracode/scripts/mc-e2e/scenarios/mcp-server-config.ts`.
- Scenario launches an embedded Mastra Code TUI with programmatic stdio `mcpServers`, lets background MCP initialization run, verifies the configured failing server is reported, then submits `/mcp status` and asserts the configured server renders with `[stdio]` transport and the reload hint.
- Break validations proven and reverted:
  1. Dropping `config.mcpServers` from `createMcpManager(project.rootPath, configDir, config?.mcpServers)` made the configured server never appear.
  2. Removing transport from `/mcp status` made the scenario fail waiting for `e2e_stdio_config [stdio]`.
  3. Disabling TUI background MCP initialization made the scenario fail waiting for the configured server failure/status.
- Focused verification: `pnpm --filter ./mastracode run e2e:test mcp-server-config`.
- Tracker row `Integrations: MCP server configuration` moved from missing e2e to partial e2e. It remains `needs-follow-up` because real HTTP/SSE tool calls, OAuth token persistence/refresh, skipped HTTP validation reasons, and headless MCP tool availability still need checked-in e2e coverage.

### 2026-06-07 — TUI e2e Harness-internal remediation rule and AIMock tool-call validation

- Decision: TUI e2e runtime behavior should stay as close to a real user as possible. Use terminal input, slash commands, keyboard navigation, AIMock model/tool fixtures, and sanitized DB/config seeding before launch. Do not use runtime Harness internals such as `harness.emit()`, direct display-state mutation, or thread APIs (`createThread()`, `getCurrentThreadId()`) as shortcuts for user-visible behavior that can be driven through `/new`, `/threads`, normal startup, or other TUI flows.
- Allowed exception: notification/state signal scenarios may use the public agent signal APIs (`sendNotificationSignal`, `sendStateSignal`) because those user-visible events originate outside terminal input.
- AIMock supports model-driven tool calls directly in fixture files with `response.toolCalls: [{ name, arguments, id? }]`. Follow-up model responses after real tool execution can use `match.hasToolResult: true`. Streaming timing can be made observable with fixture-level `streamingProfile` (`ttft`, `tps`, `jitter`) and `chunkSize`.
- Remediated `task-progress-events`: replaced the custom entrypoint that emitted `task_write`/`task_updated` Harness events with a real TUI prompt plus AIMock `response.toolCalls` calling the real `task_write` tool. Focused verification passed: `pnpm --filter ./mastracode run e2e:test task-progress-events` (2 AIMock requests; pinned task progress rendered; follow-up request included the real tool result).
- Remediated `streaming-tool-args`: replaced the custom entrypoint that emitted `tool_input_*`/`tool_start`/`tool_end` Harness events with a real TUI prompt plus AIMock streamed `response.toolCalls` calling the real `view` tool. Focused verification passed: `pnpm --filter ./mastracode run e2e:test streaming-tool-args` (2 AIMock requests; partial streamed args rendered before final `src/streaming-args.ts:12-18` range/result).
- Remediated `mcp-server-config`: removed runtime `harness.createThread()`; the scenario now relies on normal TUI startup and `/mcp status`. Focused verification passed: `pnpm --filter ./mastracode run e2e:test mcp-server-config`.
- Updated `.claude/skills/testing-mastracode-tui/SKILL.md`, `.claude/skills/mastracode-testing-recovery/SKILL.md`, and `.plan/mastracode-testing-recovery/test-recovery-system.md` so future recovery runs preserve this rule.

## 2026-06-07 — GitHub Signals gitcrawl fixture follow-up

- Added `MASTRACODE_GITCRAWL_BIN`/`GITCRAWL_BIN` wiring (with `*_GITCRAWL_COMMAND` aliases for compatibility) to Mastra Code's `GithubSignals` construction so TUI e2e scenarios can override the gitcrawl binary hermetically.
- Located the real gitcrawl store at `~/.config/gitcrawl/config.toml` and `~/.config/gitcrawl/gitcrawl.db` via read-only `gitcrawl status/doctor` and sqlite inspection. Used PR `mastra-ai/mastra#17637` row shape/check data as the basis for a sanitized, deterministic sqlite fixture; no live DB data is read by the committed test.
- Upgraded `github-signals-command` from debug-only coverage to a real-user flow: `/new`, AIMock-backed model turn to create the current thread, `/github subscribe mastra-ai/mastra#17637`, mocked gitcrawl `sync` + `threads` calls, baseline GitHub notification card, and `/github debug` metadata projection.
- Added `github-signals-command.json` AIMock fixtures for the initial model turn and notification-context follow-up so the scenario no longer passes with a hidden `No fixture matched` error.
- Break validations: setting an invalid gitcrawl command in `createMastraCode()` made the scenario fail before notification rendering; changing `/github subscribe` success text made the scenario fail waiting for `Subscribed to`; changing debug CI projection from `ci=` to `checks=` made the scenario fail waiting for `ci=failure`. All breaks were reverted.

## 2026-06-07 — First-run onboarding TUI e2e

- Added `first-run-onboarding` as the 33rd checked-in TUI e2e scenario for `Setup: Installation and launch`.
- The scenario removes seeded `settings.json`/`auth.json` before launch, verifies the first-run `Welcome to Mastra Code` setup overlay appears, selects `Skip` via real arrow/Enter key input, and asserts the normal Mastra Code TUI prompt returns without onboarding overlay text.
- Break validations: changing the welcome title, renaming the `Skip` option, and making Skip advance into Authentication instead of dismissing each failed the real PTY scenario. All breaks were reverted.
- Tracker row moved from missing to partial e2e. Built package pack/install, global/npx startup, and packed `--prompt` smoke remain missing.

## 2026-06-07 — Auto-update `/update` TUI e2e

- Added `MASTRACODE_UPDATE_LATEST_VERSION` and `MASTRACODE_UPDATE_CHANGELOG` env overrides for hermetic update prompt tests, plus `MASTRACODE_DISABLE_UPDATE_CHECK=1` to suppress automatic startup/passive checks while still allowing manual `/update`.
- Added `update-command-prompt` as the 34th checked-in TUI e2e scenario for `Setup: Auto-update prompts`.
- The scenario runs `/update` through the real TUI, renders the mocked newer version/changelog inline question, selects `No`, and verifies `Update skipped.` without executing any global package-manager install.
- Break validations: disabling the latest-version env seam, changing the update prompt headline, and renaming the `No` option each failed the real PTY scenario. All breaks were reverted.
- Tracker row moved from missing to partial e2e. Startup automatic prompt, passive recheck banner, Yes/install path, and packed-version detection remain follow-up.

## 2026-06-07 — Process shortcut TUI e2e partial coverage

- Added `process-shortcuts` as the 35th checked-in TUI e2e scenario for `TUI: Process suspend shortcut`.
- The scenario runs `/help` through the real PTY, verifies Ctrl+Z suspend and Alt+Z undo shortcut copy, types a draft, clears it with Ctrl+C, and restores it with Alt+Z.
- Break validations: changing the Ctrl+Z help text, remapping undo from Alt+Z to Alt+X, and stopping Ctrl+C from saving `lastClearedText` each failed the real PTY scenario. All breaks were reverted.
- Focused verification: `pnpm --filter ./mastracode run e2e:test process-shortcuts`.
- Tracker row moved from missing e2e to partial e2e. Actual Unix job-control coverage (`SIGTSTP` + shell `fg`/`SIGCONT`, including active streamed output after resume) remains missing until the TUI e2e runner exposes a safe suspend/resume primitive.

### Core Harness API TUI e2e partial coverage

Added `harness-api-config`, a checked-in TUI e2e scenario that launches a custom `createMastraCode()` entrypoint through the real PTY. The scenario verifies configured `configDir` loads a custom slash command, a conflicting `initialState.configDir` cannot override the configured directory, and caller `initialState.yolo=false` reaches `/yolo`.

Break validations:
- Ignoring caller `configDir` made `/help` miss `//harness-api`.
- Letting `initialState.configDir` override configured `configDir` made the wrong command directory win.
- Dropping caller `initialState` made `/yolo` toggle the default ON state to OFF instead of toggling configured OFF to ON.

The row remains partial because docs-snippet compile/API package smoke, positional-call negative tests, and docs redirect checks are still missing.

### Harness display-state e2e partial coverage

Marked `Harness display state` partial using existing checked-in, user-realistic TUI e2e coverage instead of adding duplicate Harness-internal tests. `streaming-tool-args` drives a real AIMock-streamed `view` tool call through the PTY TUI and proves live partial tool-input projection before final result replacement. `task-progress-events` drives a real AIMock `task_write` tool call and proves live task progress projection plus follow-up tool-result request handling.

Focused verification run:

```sh
pnpm --filter ./mastracode run e2e:test streaming-tool-args
```

The row remains partial because active stream → reload/history parity and long-stream coalescing/status-line update counts are still missing.

### Plan approval handoff TUI e2e coverage

Added `plan-approval-handoff`, a checked-in TUI e2e scenario that switches to Plan mode, submits a real prompt through AIMock, returns a `submit_plan` tool call, approves the inline plan card, verifies the visible structured system reminder (`The user has approved the plan, begin executing.`), and verifies the build-mode response.

Break validations:
- Changing the `Approve — switch to Build mode and implement` option label made the scenario time out before approval.
- Skipping the inline approval callback left the card locally approved but never started the build handoff.
- Changing the structured approval reminder text made the visible system-reminder assertion fail.

The row remains partial because persisted history reload as a resolved plan card, plan-file persistence in the same e2e flow, headless fallback, denied-tool guidance, and `Use as /goal` remain missing.

### Persistent goal command TUI e2e partial coverage

Added `persistent-goal-commands`, a checked-in TUI e2e scenario that seeds judge defaults, starts a persistent `/goal` through the real PTY, verifies the active-goal status-line projection (`pursuing goal`), pauses via `/goal pause`, clears via `/goal clear`, and verifies `/goal status` returns the empty-state message. The scenario uses AIMock for the model responses triggered by goal startup/judge activity but intentionally narrows to command lifecycle rather than full judge-loop validation.

Break validations:
- Changing the active-goal status-line label from `pursuing goal` made the scenario fail.
- Changing `/goal pause` feedback from `Goal paused:` made the scenario fail.
- Changing `/goal clear` feedback from `Goal cleared.` made the scenario fail.

The row remains partial because multi-turn structured judge decisions, waiting/resume behavior, reload persistence/history, and non-TUI goal behavior still need dedicated e2e coverage.

### Subagent delegation TUI e2e partial coverage

Added `subagent-delegation`, a checked-in TUI e2e scenario that submits a real parent chat prompt, uses AIMock `response.toolCalls` to invoke the built-in Explore `subagent` tool, runs the delegated Explore model turn, and verifies the real TUI renders the delegated task, completed `subagent explore openai/gpt-5.4-mini ✓` footer, and returned subagent result.

Break validations:
- Hiding the delegated task text in `handleSubagentStart()` made the scenario fail.
- Renaming the `subagent` footer label in `SubagentExecutionComponent` made the scenario fail.
- Skipping `handleSubagentEnd()` completion made the scenario fail because the footer stayed in-progress instead of showing ✓.

The row remains partial because Plan/Execute subagents, nested workspace-tool activity, forked context, `/subagents` configured model overrides, and reload/history parity still need coverage.

### Audit-tests subagent removed/not-applicable correction

Marked the historical `audit-tests` subagent row as removed / not applicable instead of missing TUI e2e. The feature was intentionally removed: no production `audit-tests`, `auditTestsSubagent`, or `Audit Tests` references remain under `mastracode/src`, and prompt tests verify the base prompt no longer advertises an `audit-tests` single-use exception.

Verification:
- `pnpm --filter ./mastracode exec vitest run src/agents/__tests__/prompts.test.ts src/agents/subagents/execute.test.ts --bail=1 --reporter=dot`
- `test -z "$(rg -n "audit-tests|auditTestsSubagent|Audit Tests" mastracode/src --glob '!**/__tests__/**')"`

No checked-in TUI e2e is appropriate unless a replacement user-facing skill or slash command is introduced.

### Debug logging TUI e2e partial coverage

Added `debug-logging`, a checked-in TUI e2e scenario that launches a real TUI with `MASTRA_DEBUG=1`, calls `setupDebugLogging()` from a custom entrypoint, emits a sentinel `console.warn`, verifies the sentinel does not leak into the terminal UI, and asserts the isolated app-data `debug.log` contains `[WARN]` plus the sentinel.

Break validations:
- Removing `MASTRA_DEBUG=1` enablement made `debug.log` missing.
- Changing the warning prefix from `[WARN]` made the log assertion fail.
- Changing the app-data filename from `debug.log` made the expected log path missing.

The row remains partial because direct `main.ts`/`headless.ts` startup-call coverage and long-session log growth behavior still need separate coverage.

### 2026-06-07 — Web search rendering TUI e2e

- Added `web-search-rendering` TUI e2e scenario with an AIMock `web_search_20250305` tool-call fixture and deterministic local extra tool, avoiding live Tavily/provider search while exercising the real TUI web-search renderer.
- Scenario verifies provider-style `sources` output renders as title/URL rows, the footer preserves `web_search "Mastra e2e web search"`, the model follow-up receives the tool result, and `encryptedContent` never appears in the terminal.
- Proved three focused breaks: corrupted provider source title extraction, removed query text from the footer, and leaked `encryptedContent` into output. All breaks failed the scenario and were reverted.
- Tracker row `Tools: Web search tool rendering` moved from missing e2e to partial e2e; wrapper-level Tavily delegation/truncation and loaded-history parity remain follow-up.

### 2026-06-07 — Commit attribution prompt TUI e2e

- Added `commit-attribution-prompt` TUI e2e scenario with an OpenAI AIMock fixture. The scenario submits a real PTY prompt and verifies the outbound model request contains the selected-model commit guidance: `Co-Authored-By: Mastra Code (openai/gpt-5.4-mini) <noreply@mastra.ai>`.
- Proved three focused breaks: removed selected model ID from the base prompt, dropped `ctx.modelId` when building the base prompt, and stopped copying `state.currentModelId` into dynamic instructions. All breaks failed the scenario and were reverted.
- Tracker row `Git: Commit attribution` moved from missing e2e to partial e2e. There are now no tracker rows with missing checked-in TUI e2e coverage; remaining work is partial-row remediation and loaded-history/runtime-parity follow-up.

### 2026-06-07 — Partial-row remediation queue drafted

- Created `remediation-queue.md` now that no tracker rows remain with missing checked-in TUI e2e coverage.
- Queue prioritizes remaining partial-row follow-up by shared fixture needs: persistent goal judge/reload, tool live-vs-history parity, notification/state signal CRUD and reload, GitHub incremental mock-gitcrawl, MCP/browser integration depth, settings/model UI breadth, and workspace/skills/hooks/shell surfaces.
- Added README and handoff pointers so future recovery runs start from the queue instead of searching all feature cards from scratch.

### 2026-06-07 — Explicit deferral review state

- Reviewed the tracker after the final missing-row e2e additions. All 56 rows now have either `validated` or `deferred-needs-review` status.
- Converted the 34 remaining partial rows from `needs-follow-up` to `deferred-needs-review`. Each row keeps its checked-in TUI e2e evidence, supporting tests, break-validation evidence, and row-specific residual contracts in the TUI status/notes.
- Added a tracker-level deferral review note and updated `remediation-queue.md` as the explicit follow-up rationale grouped by fixture/data needs. These deferred contracts are review items, not hidden unfinished tracker rows.

### 2026-06-07 — Reopened broad deferrals after user review

- User asked why 34 rows were deferred; goal judge rejected the broad deferral batch because the user had not approved it.
- Reopened all broad `deferred-needs-review` rows as unfinished `needs-follow-up`.
- Next queue item: priority 1 from `remediation-queue.md` — persistent goals judge decisions/reload parity and plan approval goal handoff.

## 2026-06-07 — Persistent goal judge/reload remediation

Added two deterministic TUI e2e scenarios for the reopened persistent `/goal` row:

- `persistent-goal-judge-decision` seeds a persisted paused goal with `lastPauseWasJudgeFailure`, loads it through `/threads`, resumes through `/goal resume`, drives AIMock judge `continue` then main continuation then judge `done`, and verifies visible `Goal ● done (2/3)` plus final `/goal status`.
- `persistent-goal-reload` seeds active goal metadata in an isolated sqlite DB, loads it via `/threads`, and verifies the status line and `/goal status` reconstruct the persisted goal.

Break validations proved the scenarios fail if `/goal resume` stops retriggering judge evaluation, if `GoalManager` does not mark `done` decisions as done, or if `loadFromThreadMetadata()` stops restoring persisted goal metadata. The persistent `/goal` tracker row is now validated; the remediation queue's top goal item moves to plan approval `Use as /goal`.

## 2026-06-07 — Plan approval `Use as /goal` remediation

Added `plan-approval-goal-handoff`, a real PTY/AIMock scenario for the second primary plan approval branch. The scenario switches to Plan mode, receives a `submit_plan` tool call, selects `Use as /goal`, verifies the canonical goal card/objective and active goal status, and verifies the approve-to-build reminder is not sent for the goal branch.

Break validations proved the scenario fails if the `Use as /goal` option label changes, if goal selection routes through the approve callback, or if the plan-to-goal objective formatter drops the canonical `# Title` heading. Together with `plan-approval-handoff` and component/unit shields for reject/request-changes/persistence/resolver behavior, the plan approval tracker row is now validated.

## 2026-06-07 — Tool history reload parity

- Added `tool-history-reload` TUI e2e scenario.
  - Seeds an isolated SQLite history thread with persisted AI SDK v2 `tool-call` / `tool-result` parts for `view`, `web_search_20250305`, and `task_write`.
  - Opens the seeded thread through `/threads` in the real PTY TUI.
  - Verifies loaded history reconstructs the `view` result card, provider-style web-search title/URL/footer without leaking `encryptedContent`, and completed task inline summary (`Tasks [2/2 completed]`).
- Break validations proved and reverted:
  1. Replaced core persisted `tool-call` mapping in `packages/core/src/harness/harness.ts` with text-only output; `tool-history-reload` failed waiting for the `view` tool card.
  2. Replaced `renderExistingMessages()` loaded tool result formatting in `mastracode/src/tui/render-messages.ts`; scenario failed waiting for the `view` result content.
  3. Disabled loaded task mutation replay in `renderExistingMessages()`; scenario failed waiting for completed inline task history.
- Tracker updates:
  - `Tools: Streaming tool arguments` moved to `validated` because live partial-to-final rendering and loaded final reconstruction are both covered.
  - `Tools: Web search tool rendering` moved to `validated` because live provider-style rendering and loaded-history parity are both covered.
  - `Tools: Task tracking tools and TUI progress`, `Tools: Workspace-backed coding tools`, and `Integrations: Harness display state` remain `needs-follow-up` but now include the `tool-history-reload` evidence.

## 2026-06-07 — Task inline live transition remediation

- Added `task-inline-transitions` TUI e2e scenario and AIMock fixture. The scenario drives real task tools through the PTY TUI: `task_write` creates two tasks, `task_complete` completes the active task, a clearing `task_write` empties the list, and a final model response completes the turn.
- Verified live completed and cleared inline transitions: `Tasks [2/2 completed]`, completed task rows, `Tasks cleared`, and final assistant response all render through the real TUI. The fixture verifies four AIMock requests and the expected task tool-call IDs.
- Break validations proved the scenario catches regressions:
  - Disabling `renderCompletedTasksInline()` in `event-dispatch.ts` timed out waiting for `Tasks [2/2 completed]`.
  - Disabling `renderClearedTasksInline()` in `event-dispatch.ts` timed out waiting for `Tasks cleared`.
  - Changing the cleared label in `render-messages.ts` from `cleared` to `removed` timed out waiting for `Tasks cleared`.
- Clean focused verification: `pnpm --filter ./mastracode run e2e:test task-inline-transitions`; `pnpm --filter ./mastracode check`; `pnpm --filter ./mastracode lint`.

## 2026-06-07 — Task patch/check live TUI remediation

- Added `task-patch-tools` TUI e2e scenario and AIMock fixture. The scenario drives real task tools through the PTY TUI: `task_write` creates a task, `task_update` patches its status/active form, `task_check` reads the current task list, and a final model response completes the turn.
- Verified live patch/check rendering: the pinned task row updates to `Verifying task patch e2e`, the `task_check` result renders `Task Status: [0/1 completed]` and `All tasks completed: NO`, and the AIMock request flow contains the expected task tool-call IDs.
- Break validations proved the scenario catches regressions:
  - Disabling live `TaskProgressComponent.updateTasks()` in `event-dispatch.ts` timed out waiting for the patched active-form row.
  - Preventing generic tool result rebuild in `ToolExecutionComponentEnhanced.updateResult()` left `task_check` stuck pending and timed out waiting for `Task Status`.
  - Returning early for `task_check` in `handleToolEnd()` also left the tool pending and timed out waiting for `Task Status`.
- Clean focused verification: `pnpm --filter ./mastracode run e2e:test task-patch-tools`; `pnpm --filter ./mastracode check`; `pnpm --filter ./mastracode lint`.
- Follow-up remains: a deterministic TUI/AIMock scenario proving updated task state is included in `<current-task-list>` prompt context on a subsequent user turn.

## 2026-06-07 — Workspace shell/LSP output rendering remediation

- Added `workspace-tool-output-rendering` TUI e2e scenario and AIMock fixture. The scenario writes a deterministic TypeScript file, drives real `execute_command` and `lsp_inspect` tool calls through the PTY TUI, and verifies shell stdout, `$` command footer, LSP file/line/match footer, and the final assistant follow-up response.
- Break validations proved the scenario catches regressions:
  - Disabling shell streaming/final result output in `ToolExecutionComponentEnhanced` timed out waiting for rendered stdout (`WORKSPACE_E2E_SHELL_OUTPUT`).
  - Stripping LSP footer args timed out waiting for `lsp_inspect src/workspace-output-e2e.ts L1`.
  - Changing the shell footer label from `$` to `shell` timed out waiting for the canonical shell footer.
- Clean focused verification: `pnpm --filter ./mastracode run e2e:test workspace-tool-output-rendering`; `pnpm --filter ./mastracode check`; `pnpm --filter ./mastracode lint`.
- The workspace-tools row remains `needs-follow-up`: live shell/LSP output rendering is now covered, but plan-mode write disabling, dynamic workspace reuse/allowed paths, subagent inheritance, and loaded-history edit/list/shell breadth still need deterministic coverage or explicit review.

## 2026-06-07 — Task prompt-context next-turn remediation

- Added `task-prompt-context-next-turn` TUI e2e scenario and AIMock fixture. The scenario drives a real `task_write`, waits for the live pinned task UI, then submits a second user prompt whose fixture only matches when the outbound system prompt contains `<current-task-list>`, `{id: prompt-context-e2e}`, and the task content.
- Break validations proved the scenario catches regressions:
  - Removing the task section from `buildFullPrompt()` caused the second-turn AIMock fixture to miss and the scenario to time out.
  - Stripping task IDs from prompt task lines caused the same fixture miss.
  - Stripping task content from prompt task lines caused the same fixture miss.
- Clean focused verification: `pnpm --filter ./mastracode run e2e:test task-prompt-context-next-turn`; `pnpm --filter ./mastracode check`; `pnpm --filter ./mastracode lint`.
- Tracker update: `Tools: Task tracking tools and TUI progress` moved to `validated` because checked-in TUI e2e now covers live progress, loaded-history replay, completed/cleared inline transitions, patch/check rendering, and next-turn prompt-context agreement.

## 2026-06-11 — Workspace plan-mode tools and request-context regression

- Fast-forwarded local `tests/mc` to `origin/tests/mc` after the Jun 9 main merge by Abhi Aiyer. Confirmed no one had continued the recovery queue: the branch still had 46 checked-in e2e scenarios and the workspace plan-mode write-tool gap remained open.
- Added `workspace-plan-mode-tools` TUI e2e scenario and AIMock fixture. The scenario submits one prompt in Build mode and one after `/mode plan`, then verifies the provider-visible tool dictionaries:
  - Build mode includes workspace write/edit tools: `write_file`, `string_replace_lsp`, `ast_smart_edit`.
  - Plan mode removes those write/edit tools while preserving `view`, `find_files`, `search_content`, and `lsp_inspect`.
- Break validations proved the scenario catches regressions in `mastracode/src/agents/workspace.ts`:
  - Disabled plan-mode filtering entirely; the scenario failed because `write_file` leaked into plan mode.
  - Removed only `write_file` from the plan-mode disabled set; the scenario failed because `write_file` leaked.
  - Accidentally disabled `view`; the scenario failed because plan mode lost a read tool.
- During validation, the full TUI e2e suite exposed a Jun 9 merge regression: task tools returned `Unable to update task list (no harness context)`. Root cause: `tool-call-step` forwarded the workflow engine step context into tool execution instead of the agent run request context, dropping the Harness context.
- Fixed `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts` to prefer the agent request context over the workflow-step context, and added a focused core regression test proving this preserves Harness context for tool execution.
- Full-suite validation also exposed a stale `github-signals-command` fixture schema after the main merge: current `@mastra/github-signals` queries `comments.body`, but the sanitized DB fixture table did not include that column, so baseline snapshot loading returned `undefined` and no notification rendered. Added the missing fixture column; the scenario passes again.
- Clean verification: `pnpm --filter ./packages/core exec vitest run src/loop/workflows/agentic-execution/tool-call-step.test.ts --bail 1 --reporter=dot`; `pnpm build:core`; `pnpm run build:mastracode`; `pnpm --filter ./mastracode run e2e:test task-progress-events`; `pnpm --filter ./mastracode run e2e:test task-inline-transitions`; `pnpm --filter ./mastracode run e2e:test task-patch-tools`; `pnpm --filter ./mastracode run e2e:test task-prompt-context-next-turn`; `pnpm --filter ./mastracode run e2e:test workspace-plan-mode-tools`; `pnpm --filter ./mastracode run e2e:test github-signals-command`; `pnpm --filter ./mastracode run e2e:test harness-api-config`; `pnpm --filter ./packages/core check`; `pnpm --filter ./mastracode check`; `pnpm --filter ./mastracode lint`; `pnpm --filter ./mastracode run e2e:test -- --jobs 2` (51/51).
- Tracker update: `Tools: Workspace-backed coding tools` moved to `validated`. Current tracker state: 28 validated, 28 `needs-follow-up`, 56 total.

## 2026-06-11 — Notification inbox tool-flow remediation

- Added `notification-inbox-tool-flow` TUI e2e scenario and AIMock fixture. The scenario uses the approved public notification signal API to emit a medium-priority GitHub notification during an active run, verifies the active-run summary card, then drives a model `notification_inbox read` tool call through AIMock and asserts the delivered notification detail card plus final read follow-up in the real PTY TUI.
- Break validations proved the scenario catches regressions:
  - Renaming the summary title from `Notification summary` to `Inbox summary` timed out waiting for the active summary card.
  - Omitting `status` from notification detail metadata timed out waiting for `medium · ci-status · delivered`.
  - Disabling `notification_inbox` registration timed out after the model attempted to read the pending notification and no delivered detail card appeared.
- Clean focused verification: `pnpm --filter ./mastracode run e2e:test notification-inbox-tool-flow`; `pnpm --filter ./mastracode check`; `pnpm --filter ./mastracode lint`.
- Tracker update: `Chat: Notification inbox signals` remains `needs-follow-up` but now covers both direct urgent delivery and summarized medium active delivery followed by `notification_inbox read`. Remaining notification gaps are CRUD actions (`list`, `markSeen`, `dismiss`, `archive`, `search`), coalesced records, and reload persistence across statuses.

## 2026-06-11 — State signal reload remediation

- Added `state-signal-reload` TUI e2e scenario. The scenario seeds a persisted `role='signal'` state DB message with state metadata (`id: browser`, `mode: delta`, `cacheKey`, `version`), reloads it via `/threads`, and verifies the real TUI reconstructs `State delta: browser` with the persisted browser-state preview.
- Break validations proved the scenario catches regressions:
  - Forcing persisted state-signal mode to `snapshot` timed out waiting for `State delta: browser`.
  - Ignoring state metadata id rendered `State delta: state` and timed out waiting for `browser`.
  - Renaming the visible state-signal title timed out waiting for the canonical `State delta: browser` label.
- Clean focused verification: `pnpm build:core`; `pnpm --filter ./mastracode run e2e:test state-signal-reload`; `pnpm --filter ./mastracode check`; `pnpm --filter ./mastracode lint`.
- Tracker update: `Chat: Processor state signals` remains `needs-follow-up` but now covers both active `sendStateSignal()` rendering and persisted signal reload parity. Remaining gaps are live browser-processor context and long-session snapshot/delta pruning.

## 2026-06-11 — GitHub incremental signal remediation

- Added `github-signals-incremental` TUI e2e scenario and AIMock fixture. The scenario seeds a persisted subscribed thread whose GitHub cursor last observed failing CI, points `MASTRACODE_GITCRAWL_BIN` and `GITCRAWL_DB_PATH` at a deterministic sanitized gitcrawl sqlite snapshot where CI has recovered, switches to the thread through `/threads`, runs `/github sync`, and verifies the real TUI renders the `pull-request-ci-recovered` notification plus `/github debug` `ci=success` cursor projection.
- Break validations rebuilt `@mastra/github-signals` after temporary source changes and proved the scenario catches regressions:
  - Disabling non-first-observation change detection caused no recovered-CI notification request and the scenario timed out.
  - Corrupting the recovered-CI notification summary caused the visible recovered notification assertion to time out.
  - Disabling `lastObservedCiState` cursor persistence allowed the notification but timed out on `/github debug` waiting for `ci=success`.
- Clean focused verification: `pnpm --filter @mastra/github-signals build`; `pnpm --filter ./mastracode run e2e:test github-signals-incremental`; `pnpm --filter ./mastracode check`; `pnpm --filter ./mastracode lint`.
- Tracker update: `Git: GitHub signal subscriptions` remains `needs-follow-up` but now covers command subscribe/baseline notification/debug projection and manual-sync incremental recovered-CI notification classification/cursor persistence. Remaining gaps are interval polling delivery, notification inbox read transitions, branch auto-subscribe lifecycle, unsubscribe/reload, and reload/history parity.

## 2026-06-11 — Request access prompt remediation

- Selected `TUI: Interactive prompts and access requests` as the next high-risk unfinished row by tracker priority.
- Added `request-access-modal` TUI e2e scenario and AIMock fixture. The scenario creates a deterministic external `/tmp/mastracode-request-access-e2e/allowed.txt` file, has the model call the real `request_access` tool for that outside-project directory, verifies the real TUI sandbox approval prompt/reason/options, approves the default `Yes` option with Enter, verifies the access-granted tool result, then has the model call `view` on the external file and verifies its content renders in the TUI.
- Break validations proved the scenario catches regressions:
  - Renaming the visible prompt copy from `Grant sandbox access` caused the scenario to time out waiting for the canonical prompt.
  - Corrupting approval parsing so selected `Yes` no longer approved access caused the scenario to time out waiting for the granted result/external read.
  - Emitting the wrong sandbox access event type prevented the TUI prompt from rendering and timed out waiting for the prompt.
- Clean verification: `pnpm run build:mastracode`; `pnpm --filter ./mastracode run e2e:test request-access-modal`; `pnpm --filter ./mastracode run e2e:test -- --jobs 2` (55/55); `pnpm --filter ./mastracode check`; `pnpm --filter ./mastracode lint`.
- Tracker update: `TUI: Interactive prompts and access requests` remains `needs-follow-up` but now covers sensitive masked input and request_access approval/same-turn external-read behavior through real PTY e2e. Remaining gaps are ask_user multiline/custom/multi-select queueing and queued prompt interleaving.

## 2026-06-11 — ask_user advanced prompt remediation

- Continued the `TUI: Interactive prompts and access requests` row after `request-access-modal` by targeting the remaining `ask_user` prompt-shape gap.
- Added `ask-user-advanced-prompts` TUI e2e scenario and AIMock fixture. The scenario has the model call the real `ask_user` tool three times, then drives the real PTY TUI to enter a multiline free-text answer with backslash+Enter, select `Custom response...` from a single-select prompt and type a custom answer, and toggle multiple fixed options in a `multi_select` prompt with Space before confirming with Enter.
- Break validations proved the scenario catches regressions:
  - Disabling `handleAskQuestion()` multiline opt-in dropped the Shift+Enter/backslash+Enter hint and failed the scenario.
  - Renaming the visible `Custom response...` picker row caused the scenario to time out waiting for the canonical custom-response affordance.
  - Dropping `selectionMode` propagation prevented the multi-select prompt from reaching the expected checkbox/hint state and failed the scenario.
- Clean verification: `pnpm --filter ./mastracode run e2e:test ask-user-advanced-prompts`; `pnpm --filter ./mastracode check`; `pnpm --filter ./mastracode lint`; `pnpm run build:mastracode`; `pnpm --filter ./mastracode run e2e:test -- --jobs 2` (56/56).
- Tracker update: `TUI: Interactive prompts and access requests` remains `needs-follow-up` but now covers masked sensitive input, request_access approval/same-turn external-read behavior, and ask_user multiline/custom/multi-select prompts through checked-in real PTY e2e coverage. Remaining gap is queued prompt interleaving through the real TUI.

## 2026-06-11 — queued prompt interleaving remediation

- Continued the `TUI: Interactive prompts and access requests` row after `ask-user-advanced-prompts` by targeting the remaining real-TUI prompt queue interleaving gap.
- Added `prompt-queue-interleave` TUI e2e scenario and AIMock fixture. The fixture emits simultaneous `ask_user` and `request_access` tool calls. The scenario verifies the `ask_user` prompt remains active and answerable while the access request is pending, then the access prompt activates after the first answer, accepts the default `Yes` option, renders `Access granted`, and the model turn completes.
- Break validations proved the scenario catches regressions:
  - Activating the sandbox access prompt immediately instead of queueing it overwrote the active prompt input target; the scenario timed out waiting for the first prompt answer.
  - Disabling `processNextInlineQuestion()` queue draining left the request_access tool pending forever; the scenario timed out waiting for the access prompt.
  - Propagating `No` from the queued access prompt despite selecting `Yes` rendered `Access denied` and failed the access-granted assertion.
- Clean focused verification: `pnpm --filter ./mastracode run e2e:test prompt-queue-interleave`.
- Tracker update: `TUI: Interactive prompts and access requests` is now `validated`. It has checked-in real PTY coverage for masked prompt input, request_access approval/same-turn external reads, ask_user multiline/custom/multi-select prompt shapes, and queued ask_user/request_access interleaving. Remaining long-answer/dialog/headless breadth is documented as deferred lower-priority/non-TUI breadth on the feature card.

## 2026-06-11 — setup nested model selector remediation

- Selected `TUI: Configuration modal overlays` as the next high-priority unfinished row after prompt queue interleaving.
- Added `setup-nested-model-selector` TUI e2e scenario. The scenario opens `/setup`, continues past the welcome step, skips auth, chooses the custom model pack, enters a deterministic custom pack name, verifies the nested `ModelSelectorComponent` overlay appears for plan mode, cancels it with Escape, and asserts the parent setup overlay resumes at Observational Memory while the selector is gone.
- Break validations proved the scenario catches regressions:
  - Removing `hideOverlay()` from the nested model selector cancel callback left the selector stuck and timed out waiting for the parent setup overlay.
  - Skipping the parent `omPack` render after custom-pack model selector cancel left setup stalled after the collapsed model-pack line and timed out waiting for Observational Memory.
  - Disabling the model selector Escape cancel callback left the selector visible and failed the same parent-overlay recovery assertion.
- Clean focused verification: `pnpm --filter ./mastracode run e2e:test setup-nested-model-selector`.
- Tracker update: `TUI: Configuration modal overlays` is now `validated`. It has checked-in real PTY coverage for simple `/sandbox` overlay open/Escape and nested `/setup` model-selector Escape/back navigation. Remaining visual snapshot contrast and less common config command breadth are documented as follow-up breadth.

### Quiet mode live/history parity

Added `quiet-tool-history-parity` TUI e2e coverage. The scenario seeds Quiet mode and a two-line preview cap, drives AIMock-backed live `view` + `task_write` tool calls, asserts compact `▐view▌` quiet chrome, preview-cap output, and quiet task summary, then switches through `/threads` to a seeded persisted tool-history thread and asserts loaded `view` history also renders with compact quiet chrome and preview text.

Break validations:
- Disabled quiet `view` previews in `tool-execution-enhanced.ts`; the scenario timed out waiting for the compact preview.
- Disabled loaded-history quiet conversion in `render-messages.ts`; the scenario showed expanded historical tool output instead of compact `▐view▌` chrome and failed.
- Disabled live quiet conversion in `handlers/tool.ts`; the live tool rendered expanded output instead of compact quiet chrome and failed.

Focused verification: `pnpm --filter ./mastracode run e2e:test quiet-tool-history-parity`.

### OM global settings persistence

Added `om-global-settings-persistence` TUI e2e coverage for the Settings: Onboarding and global settings row. The scenario creates an active AIMock-backed thread, opens `/om`, toggles Caveman observations and Observe attachments through real keyboard navigation, then uses shell passthrough to prove global `settings.json` persisted `omCavemanObservations=true` and `omObserveAttachments=true`, and that active-thread metadata contains the corresponding OM setting keys.

Break validations:
- Forced caveman global persistence to write `false`; the scenario timed out waiting for `OM_GLOBAL_CAVEMAN=true`.
- Forced observe-attachments global persistence to write `auto`; the scenario timed out waiting for `OM_GLOBAL_ATTACH=true`.
- Changed the visible Observe attachments value projection from `On` to `Enabled`; the scenario timed out waiting for `Observe attachments On`.

Focused verification: `pnpm --filter ./mastracode run e2e:test om-global-settings-persistence`.

### Setup completion persistence

Added `setup-completion-persistence` TUI e2e coverage for the Settings: Onboarding and global settings row. The scenario seeds deterministic Memory Gateway provider access, runs `/setup`, skips auth, selects the OpenAI mode pack, selects OpenAI Mini for observational memory, disables YOLO, then uses shell passthrough to assert `settings.json` has completed onboarding, no skipped marker, `openai` mode/OM pack IDs, `yolo=false`, and no custom mode defaults for the built-in pack.

Break validations:
- Nulled `settings.onboarding.completedAt` in `applyOnboardingResult`; the scenario failed waiting for `SETUP_COMPLETED=true`.
- Corrupted persisted `settings.onboarding.modePackId`; the scenario failed waiting for `SETUP_MODE=openai:openai`.
- Forced `settings.preferences.yolo=true`; the scenario failed waiting for `SETUP_YOLO=false`.

Verification: `pnpm run build:mastracode`; `pnpm --filter ./mastracode run e2e:test setup-completion-persistence`; `pnpm --filter ./mastracode run e2e:test --jobs 2` (61/61); `pnpm --filter ./mastracode check`; `pnpm --filter ./mastracode lint`.

### Models pack activation persistence

Added `models-pack-activation-persistence` TUI e2e coverage for the Settings: Onboarding and global settings row. The scenario seeds a deterministic custom OpenAI-compatible provider plus saved custom model pack, opens `/models`, activates the pack through the real switcher and custom-pack action overlay, then uses shell passthrough to assert `settings.json` has `activeModelPackId=custom:Models Pack E2E`, the three custom mode defaults, cleared stale subagent overrides, and retained custom-pack storage.

Break validations:
- Disabled active custom-pack persistence in `/models`; the scenario failed waiting for `MODELS_ACTIVE=custom:Models Pack E2E`.
- Cleared custom mode defaults during activation; the scenario failed waiting for the expected `MODELS_DEFAULTS` values.
- Skipped stale subagent override cleanup; the scenario failed waiting for `MODELS_SUBAGENTS=0`.

Verification: `pnpm run build:mastracode`; `pnpm --filter ./mastracode run e2e:test models-pack-activation-persistence`; `pnpm --filter ./mastracode run e2e:test --jobs 2` (62/62); `pnpm --filter ./mastracode check`; `pnpm --filter ./mastracode lint`.

### Notification inbox CRUD/search lifecycle

Added `notification-inbox-crud-flow` TUI e2e coverage for the Chat: Notification inbox signals row. The scenario creates deterministic notification records in the isolated current thread, then uses AIMock tool-call fixtures to drive `notification_inbox list`, `markSeen`, `dismiss`, `archive`, and `search` through the real TUI. It asserts a list-only notification is visible and that `seen`, `dismissed`, and `archived` status transitions are searchable with their expected summaries.

Break validations:
- Forced `notification_inbox list` to filter `seen` records instead of the requested pending records; the scenario timed out waiting for the list-only notification.
- Mapped `markSeen` back to `pending`; the scenario timed out waiting for the searchable `"status": "seen"` result.
- Mapped `archive` back to `pending`; the scenario timed out waiting for the archived canary search result.

Verification: `pnpm build:core`; `pnpm --filter ./mastracode run e2e:test notification-inbox-crud-flow`; `pnpm --filter ./mastracode check`; `pnpm --filter ./mastracode lint`.


### Browser status projection — 2026-06-13

- Added focused `browser.test.ts` coverage for active-vs-pending `/browser status` rendering of profile, executable, and AgentBrowser storage-state fields, plus storage-state-only drift detection.
- Break validation 1: removed active storage-state rendering from `browser.ts`; focused browser command test failed waiting for the active storage-state line. Reverted.
- Break validation 2: removed pending executable rendering from `browser.ts`; focused browser command test failed waiting for the pending executable line. Reverted.
- Break validation 3: removed storage-state from `getBrowserConfigKey`; focused browser command test failed because storage-only changes rendered normal `Browser: enabled` status instead of active/pending drift. Reverted.
- Verification: `pnpm run build:mastracode` passed (24/24 cached); focused `pnpm --filter ./mastracode exec vitest run src/tui/commands/__tests__/browser.test.ts --reporter=dot --bail 1` passed (3/3); `pnpm --filter ./mastracode check` clean; `pnpm --filter ./mastracode lint` clean.


### Custom provider modal validation — 2026-06-13

- Added `custom-provider-modal-validation` TUI e2e for duplicate-provider rejection, invalid URL rejection, create-provider success, and remove-model persistence through `/custom-providers`.
- Break validation 1: disabled the duplicate-provider guard in `createProviderFlow`; scenario failed waiting for `Provider already exists` and advanced to the Base URL prompt. Reverted.
- Break validation 2: made `isValidUrl()` accept every value; scenario failed waiting for the invalid URL error and advanced to API-key input. Reverted.
- Break validation 3: changed remove-model persistence to keep the selected model; scenario failed with `Unable to remove model from provider` instead of the removed-model success message. Reverted.
- Verification: `pnpm run build:mastracode` passed (24/24 cached); focused `pnpm --filter ./mastracode run e2e:test custom-provider-modal-validation` passed; `pnpm --filter ./mastracode check` clean; `pnpm --filter ./mastracode lint` clean; full TUI e2e `pnpm --filter ./mastracode run e2e:test -- --jobs 4` passed 117/117.
