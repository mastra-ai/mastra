# Model authentication, selection, and modes

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — OAuth/API-key providers, model selection, and Build/Plan/Fast modes.
- Later changes: [#13231](https://github.com/mastra-ai/mastra/pull/13231) — runtime model selection from request context and gateway heartbeat sync; [#13245](https://github.com/mastra-ai/mastra/pull/13245) — moved mode/model runtime ownership onto core Harness sessions; [#13307](https://github.com/mastra-ai/mastra/pull/13307) — reloads AuthStorage before model resolution to avoid stale OpenAI Codex credentials; [#13421](https://github.com/mastra-ai/mastra/pull/13421) — added onboarding/global settings and model packs; [#13431](https://github.com/mastra-ai/mastra/pull/13431) — temporarily changed Codex defaults, but current source now uses OpenAI `gpt-5.5` pack/login defaults; [#13500](https://github.com/mastra-ai/mastra/pull/13500) — onboarding accepts API-key-only access without OAuth; [#13505](https://github.com/mastra-ai/mastra/pull/13505) / [#13508](https://github.com/mastra-ai/mastra/pull/13508) — added and strengthened Claude Max OAuth warning, later removed by #14605 in current source; [#13490](https://github.com/mastra-ai/mastra/pull/13490) — wired `/think`/thinking state into OpenAI Codex reasoning effort; [#13512](https://github.com/mastra-ai/mastra/pull/13512) — unified `/models` around the pack selector and improved custom pack edit/import/delete behavior; [#13566](https://github.com/mastra-ai/mastra/pull/13566) — checks the full provider registry for API-key access instead of only hardcoded providers.

## User-visible behavior

- What the user can do: authenticate providers, choose model packs, create/edit/share/import custom packs, switch modes, and run headless with model/mode flags.
- Success looks like: footer, prompt/runtime model, `/models` selected pack, provider API-key availability, and persisted thread/session state agree.
- Must preserve: selected model/mode across thread switch and restart, targeted custom pack edits, model use-count ranking, and safe fallback to defaults.

## Entry points / commands

- Commands / shortcuts / flags: `/login`, `/models`, `/setup`, `/mode`, `/think`, Shift+Tab, `--model`, `--mode`, `--thinking-level`.
- Automatic triggers: startup provider access checks, settings/model-pack defaults, thread/session metadata sync.

## TUI states

- Idle: footer/status shows current mode/model and auth availability; `/models` opens the single model-pack selector path.
- Active / modal / error: model selection prompts for missing keys; custom packs use action/edit/import/share overlays; mode switching is blocked during active runs/plan approval.

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
| Provider credentials | AuthStorage/settings/env + provider registry `apiKeyEnvVar`, reloaded by `resolveModel()` | Model resolver, auth prompts, onboarding access gate, pack filtering |
| Model packs | Settings + thread active pack metadata | `/setup`, `/models`, session defaults |
| Custom pack CRUD/import/share | `settings.json` custom packs + clipboard payloads | `/models` custom action flow, startup defaults |
| Model use counts | `settings.json` `modelUseCounts`, updated by Harness `switchModel()` | Model selector ranking |
| Thinking level | Harness/settings | Model provider options, prompt context, `/think` |

## Key files

- `mastracode/src/index.ts` — provider checks, registry API-key env scan, mode defaults, session prefill.
- `mastracode/src/agents/model.ts` — provider/model resolution.
- `mastracode/src/auth/storage.ts` — credential persistence and refresh.
- `mastracode/src/onboarding/packs.ts` — provider-filtered built-in model packs.
- `mastracode/src/onboarding/settings.ts` — global settings and model-pack resolution.
- `mastracode/src/tui/commands/models-pack.ts` — unified `/models` pack selector, custom pack edit/delete/share/import flow, and OpenAI pack thinking auto-enable.
- `mastracode/src/tui/components/model-selector.ts` — model search/sort list with current/auth/use-count ordering.
- `mastracode/src/tui/commands/mode.ts` — `/mode`.
- `mastracode/src/headless.ts` — model/mode flags.

## Dependencies / related features

- [Persistent conversations](../threads/persistent-conversations.md) — reload preservation uses thread/session metadata.
- [Interactive TUI chat](../tui/interactive-chat.md) — active chat runs through selected model/mode.
- [Thinking and reasoning effort](./thinking-and-reasoning.md) — model selection determines whether `/think` affects provider options.

## Existing tests

- `mastracode/src/agents/__tests__/model.test.ts` — provider/model resolution and generic `authStorage.reload()` assertion.
- `mastracode/src/__tests__/codex-model-routing.test.ts` — Codex routing.
- `mastracode/src/onboarding/__tests__/packs.test.ts`, `settings.test.ts` — built-in pack defaults and settings resolution.
- `mastracode/src/tui/commands/__tests__/models-pack.test.ts` — custom pack upsert/remove/rename/edit/share/import helpers and serialization.
- `mastracode/src/tui/__tests__/command-dispatch.test.ts` — verifies `/models:pack` is no longer routed as a valid command.
- `mastracode/src/tui/commands/__tests__/mode.test.ts` — mode switching.
- `mastracode/src/HarnessCompat.test.ts`, `headless.test.ts` — session/headless coverage.

## Missing tests

- Select model pack → restart TUI → footer/runtime/prompt model agree.
- Thread switch preserves per-thread model without overwriting defaults.
- Full TUI overlay journey for custom pack action picker, targeted edit, import collision, share, delete, and activation.
- Headless `--model` precedence over `--mode` after Harness v1 migration.
- OpenAI Codex-specific stale credential regression test after login/auth file update.
- Startup/onboarding regression for a non-hardcoded registry provider API key (for example Groq/Mistral) enabling provider access and custom model selection.

## Known risks / regressions

- Slack reported “No model selected” after reload using model packs.
- PR #17411 / #17546 history suggests session-state composition was risky here.
- Env leakage caused model tests to fail in audits; isolate env before blaming product code.
- Provider registry `apiKeyEnvVar` can be string or array; startup/setup/model-picker access can drift if one path only handles one shape.
- Built-in OpenAI/Codex defaults drift; tests currently assert `gpt-5.5` even though #13431 temporarily changed defaults to `gpt-5.2`.
- Pack identity can be global, thread-scoped, inferred from per-mode IDs, or removed during custom pack cleanup; stale IDs are a reload risk.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
