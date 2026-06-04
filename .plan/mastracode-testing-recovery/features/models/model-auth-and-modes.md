# Model authentication, selection, and modes

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — OAuth/API-key providers, model selection, and Build/Plan/Fast modes.
- Later changes: [#13231](https://github.com/mastra-ai/mastra/pull/13231) — runtime model selection from request context and gateway heartbeat sync; [#13245](https://github.com/mastra-ai/mastra/pull/13245) — moved mode/model runtime ownership onto core Harness sessions; [#13307](https://github.com/mastra-ai/mastra/pull/13307) — reloads AuthStorage before model resolution to avoid stale OpenAI Codex credentials; [#13421](https://github.com/mastra-ai/mastra/pull/13421) — added onboarding/global settings and model packs; [#13431](https://github.com/mastra-ai/mastra/pull/13431) — temporarily changed Codex defaults, but current source now uses OpenAI `gpt-5.5` pack/login defaults.

## User-visible behavior

- What the user can do: authenticate providers, choose models, switch modes, and run headless with model/mode flags.
- Success looks like: footer, prompt/runtime model, and persisted thread/session state agree.
- Must preserve: selected model/mode across thread switch and restart, or safe fallback to defaults.

## Entry points / commands

- Commands / shortcuts / flags: `/login`, `/models`, `/setup`, `/mode`, Shift+Tab, `--model`, `--mode`, `--thinking-level`.
- Automatic triggers: startup provider access checks, settings/model-pack defaults, thread/session metadata sync.

## TUI states

- Idle: footer/status shows current mode/model and auth availability.
- Active / modal / error: model selection prompts for missing keys; mode switching blocked during active runs/plan approval.

## Headless / non-TUI behavior

- Supported: `--model` overrides; `--mode` selects Build/Plan/Fast; same AuthStorage/settings path.
- Not supported / unknown: interactive auth prompts are TUI-oriented; headless should fail clearly if auth is unavailable.

## Streaming / loading / interrupted states

- Streaming / loading: active run should keep the model selected when the run started.
- Abort / retry / resume: model/mode changes are between-run state, not streamed message history.

## Streaming vs loaded-from-history behavior

- While actively streaming: harness session model/mode drives runtime and footer projection.
- After reload / history reconstruction: `createMastraCode()` seeds sessions from thread metadata/session records or mode defaults.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Current model ID | Harness session + persisted thread/session metadata | Runtime, footer, prompt context |
| Current mode ID | Harness session | Runtime, footer, prompt mode section |
| Provider credentials | AuthStorage/settings/env, reloaded by `resolveModel()` | Model resolver, auth prompts |
| Model packs | Settings + thread active pack metadata | `/setup`, `/models`, session defaults |
| Thinking level | Harness/settings | Model provider options, prompt context |

## Key files

- `mastracode/src/index.ts` — provider checks, mode defaults, session prefill.
- `mastracode/src/agents/model.ts` — provider/model resolution.
- `mastracode/src/auth/storage.ts` — credential persistence and refresh.
- `mastracode/src/onboarding/packs.ts` — provider-filtered built-in model packs.
- `mastracode/src/onboarding/settings.ts` — global settings and model-pack resolution.
- `mastracode/src/tui/commands/models-pack.ts` — `/models` UI.
- `mastracode/src/tui/commands/mode.ts` — `/mode`.
- `mastracode/src/headless.ts` — model/mode flags.

## Dependencies / related features

- [Persistent conversations](../threads/persistent-conversations.md) — reload preservation uses thread/session metadata.
- [Interactive TUI chat](../tui/interactive-chat.md) — active chat runs through selected model/mode.

## Existing tests

- `mastracode/src/agents/__tests__/model.test.ts` — provider/model resolution and generic `authStorage.reload()` assertion.
- `mastracode/src/__tests__/codex-model-routing.test.ts` — Codex routing.
- `mastracode/src/onboarding/__tests__/packs.test.ts`, `settings.test.ts` — built-in pack defaults and settings resolution.
- `mastracode/src/tui/commands/__tests__/models-pack.test.ts` — model packs.
- `mastracode/src/tui/commands/__tests__/mode.test.ts` — mode switching.
- `mastracode/src/HarnessCompat.test.ts`, `headless.test.ts` — session/headless coverage.

## Missing tests

- Select model pack → restart TUI → footer/runtime/prompt model agree.
- Thread switch preserves per-thread model without overwriting defaults.
- Headless `--model` precedence over `--mode` after Harness v1 migration.
- OpenAI Codex-specific stale credential regression test after login/auth file update.

## Known risks / regressions

- Slack reported “No model selected” after reload using model packs.
- PR #17411 / #17546 history suggests session-state composition was risky here.
- Env leakage caused model tests to fail in audits; isolate env before blaming product code.
- Built-in OpenAI/Codex defaults drift; tests currently assert `gpt-5.5` even though #13431 temporarily changed defaults to `gpt-5.2`.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
