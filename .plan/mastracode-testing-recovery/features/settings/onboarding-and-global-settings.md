# Onboarding and global settings

## Origin PR / commit

- PR: [#13421](https://github.com/mastra-ai/mastra/pull/13421) — interactive first-run `/setup` flow, persisted global settings, built-in/custom model packs, OM packs, and YOLO preference.
- Later changes: [#13431](https://github.com/mastra-ai/mastra/pull/13431) — temporarily changed Codex defaults; current source now uses OpenAI `gpt-5.5` defaults; [#13435](https://github.com/mastra-ai/mastra/pull/13435) — added persisted storage backend settings for LibSQL/PostgreSQL; [#13487](https://github.com/mastra-ai/mastra/pull/13487) — added persisted theme preference; [#13494](https://github.com/mastra-ai/mastra/pull/13494) — fixed the supported-providers documentation URL in onboarding; [#13500](https://github.com/mastra-ai/mastra/pull/13500) — allows onboarding to proceed with API-key-only provider access instead of requiring OAuth/built-in packs; [#13505](https://github.com/mastra-ai/mastra/pull/13505) / [#13508](https://github.com/mastra-ai/mastra/pull/13508) — added and then strengthened an Anthropic OAuth warning, but current source has removed that flow via later #14605.

## User-visible behavior

- What the user can do: complete first-run setup or re-run `/setup`; use OAuth or configured API keys; choose mode model pack, OM pack, and YOLO default.
- Success looks like: selected pack updates current run, thread metadata, global settings, subagent defaults, OM models, and status line; API-key-only providers do not get blocked at the auth step.
- Must preserve: skipped/completed onboarding state, active model/OM pack IDs, custom packs, provider access detection, YOLO preference, and settings migrations.

## Entry points / commands

- Commands / shortcuts / flags: `/setup`, `/models`, `/theme`, provider login prompts.
- Automatic triggers: startup shows onboarding when settings have neither completed nor skipped the current onboarding version.

## TUI states

- Idle: setup wizard renders as modal overlay; `/models` opens model-pack switcher/import/edit flow.
- Active / modal / error: onboarding can launch login, refresh available packs after login, show API-key docs/copy when no provider access is detected, prompt API keys during custom model selection, or be cancelled/skipped.
- Historical note: Anthropic OAuth warning modals from #13505/#13508 are not active in current source; current login/setup flows go straight through auth mode + login dialog. The #13508 warning specifically strengthened the now-removed copy to mention reported bans and Terms of Service risk.

## Headless / non-TUI behavior

- Supported: startup reads `settings.json` for model defaults, OM defaults, YOLO, thinking level, browser/storage/signal settings, and custom providers.
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
| Active model pack | Thread setting `activeModelPackId` + global settings fallback | `/models`, startup default resolution, footer/runtime model state |
| Custom model packs | `settings.json` `customModelPacks` | `/setup`, `/models`, startup `resolveModelDefaults()` |
| Provider access | AuthStorage + env/API-key detection | Onboarding auth gate, pack filtering, model prompts |
| OM pack/model | Harness state + global settings OM fields | OM memory factory, `/om`, setup wizard |
| YOLO/quiet preferences | Harness state + global settings preferences | Permission prompts, tool/task rendering |
| Storage backend | Global settings + env overrides | Storage factory, memory/history persistence |
| Theme preference | Global settings + `MASTRA_THEME` env override | Startup detection, `/theme`, TUI colors |

## Key files

- `mastracode/src/onboarding/onboarding-inline.ts` — setup wizard UI, API-key/OAuth copy, step flow, and supported-provider docs link.
- `mastracode/src/onboarding/settings.ts` — `settings.json` schema, migrations, defaults, and pack resolution.
- `mastracode/src/onboarding/packs.ts` — provider-filtered built-in mode/OM packs plus always-available custom packs.
- `mastracode/src/tui/mastra-tui.ts` — startup onboarding trigger and `applyOnboardingResult()` runtime persistence.
- `mastracode/src/tui/commands/models-pack.ts` — `/models` pack switch/custom/edit/share/import behavior.
- `mastracode/src/index.ts` — startup resolution of settings into Harness modes, OM state, subagents, storage, and preferences.
- `mastracode/src/auth/storage.ts` — provider post-login default model IDs.

## Dependencies / related features

- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — mode model defaults and auth checks.
- [Observational memory](../memory/observational-memory.md) — setup selects default OM model pack.
- [Persistent conversations](../threads/persistent-conversations.md) — per-thread model-pack metadata overrides global defaults.
- [Storage backend configuration](./storage-backend.md) — storage backend choice is persisted in the same global settings file.
- [Terminal theme and contrast](../tui/terminal-theme.md) — theme preference is persisted in global settings.

## Existing tests

- `mastracode/src/onboarding/__tests__/settings.test.ts` — settings parsing, migrations, pack resolution, thread active pack inference.
- `mastracode/src/onboarding/__tests__/packs.test.ts` — provider-gated built-in packs, current OpenAI/GitHub defaults, and API-key/OAuth pack visibility inputs.
- `mastracode/src/tui/commands/__tests__/models-pack.test.ts` — custom pack upsert/remove/rename/edit/share/import helpers.
- `mastracode/src/__tests__/index.test.ts` — startup settings plumbing is partially mocked.

## Missing tests

- First-run onboarding wizard end-to-end: cancel, API-key-only provider access, login refresh, custom pack, OM pack, YOLO, persisted settings.
- Reload after `/setup`: footer/runtime model, thread metadata, subagent defaults, and OM defaults all agree.
- `/models` activation/import flow through real TUI overlay, not only helper functions.
- Headless startup with active model pack and custom pack settings.

## Known risks / regressions

- State is split across live harness session, thread metadata, global settings, auth storage, and UI projections.
- Provider access can be true from API keys even when no non-custom built-in mode pack is available; onboarding must use the explicit `hasProviderAccess` flag, not infer from pack count.
- Built-in pack model IDs drift over time; current source uses OpenAI `gpt-5.5` even though #13431 temporarily lowered Codex defaults.
- Earlier Slack regression around “No model selected” after reload likely lives near this settings/session boundary.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
