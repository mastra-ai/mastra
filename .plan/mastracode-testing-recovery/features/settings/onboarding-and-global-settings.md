# Onboarding and global settings

## Origin PR / commit

- PR: [#13421](https://github.com/mastra-ai/mastra/pull/13421) — interactive first-run `/setup` flow, persisted global settings, built-in/custom model packs, OM packs, and YOLO preference.
- Later changes: [#13431](https://github.com/mastra-ai/mastra/pull/13431) — temporarily changed Codex defaults; current source now uses OpenAI `gpt-5.5` defaults.

## User-visible behavior

- What the user can do: complete first-run setup or re-run `/setup`; choose provider login, mode model pack, OM pack, and YOLO default.
- Success looks like: selected pack updates current run, thread metadata, global settings, subagent defaults, OM models, and status line.
- Must preserve: skipped/completed onboarding state, active model/OM pack IDs, custom packs, YOLO preference, and settings migrations.

## Entry points / commands

- Commands / shortcuts / flags: `/setup`, `/models`, provider login prompts.
- Automatic triggers: startup shows onboarding when settings have neither completed nor skipped the current onboarding version.

## TUI states

- Idle: setup wizard renders as modal overlay; `/models` opens model-pack switcher/import/edit flow.
- Active / modal / error: onboarding can launch login, refresh available packs after login, prompt API keys during custom model selection, or be cancelled/skipped.

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
| OM pack/model | Harness state + global settings OM fields | OM memory factory, `/om`, setup wizard |
| YOLO/quiet preferences | Harness state + global settings preferences | Permission prompts, tool/task rendering |

## Key files

- `mastracode/src/onboarding/onboarding-inline.ts` — setup wizard UI and step flow.
- `mastracode/src/onboarding/settings.ts` — `settings.json` schema, migrations, defaults, and pack resolution.
- `mastracode/src/onboarding/packs.ts` — provider-filtered built-in mode/OM packs.
- `mastracode/src/tui/mastra-tui.ts` — startup onboarding trigger and `applyOnboardingResult()` runtime persistence.
- `mastracode/src/tui/commands/models-pack.ts` — `/models` pack switch/custom/edit/share/import behavior.
- `mastracode/src/index.ts` — startup resolution of settings into Harness modes, OM state, subagents, and preferences.
- `mastracode/src/auth/storage.ts` — provider post-login default model IDs.

## Dependencies / related features

- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — mode model defaults and auth checks.
- [Observational memory](../memory/observational-memory.md) — setup selects default OM model pack.
- [Persistent conversations](../threads/persistent-conversations.md) — per-thread model-pack metadata overrides global defaults.

## Existing tests

- `mastracode/src/onboarding/__tests__/settings.test.ts` — settings parsing, migrations, pack resolution, thread active pack inference.
- `mastracode/src/onboarding/__tests__/packs.test.ts` — provider-gated built-in packs and current OpenAI/GitHub defaults.
- `mastracode/src/tui/commands/__tests__/models-pack.test.ts` — custom pack upsert/remove/rename/edit/share/import helpers.
- `mastracode/src/__tests__/index.test.ts` — startup settings plumbing is partially mocked.

## Missing tests

- First-run onboarding wizard end-to-end: cancel, login refresh, custom pack, OM pack, YOLO, persisted settings.
- Reload after `/setup`: footer/runtime model, thread metadata, subagent defaults, and OM defaults all agree.
- `/models` activation/import flow through real TUI overlay, not only helper functions.
- Headless startup with active model pack and custom pack settings.

## Known risks / regressions

- State is split across live harness session, thread metadata, global settings, auth storage, and UI projections.
- Built-in pack model IDs drift over time; current source uses OpenAI `gpt-5.5` even though #13431 temporarily lowered Codex defaults.
- Earlier Slack regression around “No model selected” after reload likely lives near this settings/session boundary.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
