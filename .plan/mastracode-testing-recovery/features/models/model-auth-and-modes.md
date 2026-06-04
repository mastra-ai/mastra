# Model authentication, selection, and modes

## Origin PR / commit

- PR: [#13218](https://github.com/mastra-ai/mastra/pull/13218) — introduced OAuth-backed model providers, multi-model support, build/plan/fast modes, model selector UI, and auth-aware model resolution.
- Commit: `0e64154f1b` — `MastraCode initial port (#13218)`.

## User-visible behavior

Users can authenticate with AI providers, choose models, and switch execution modes. The footer/status line should show a coherent current mode/model, model changes should affect subsequent agent runs, and thread reload should preserve the selected model/mode or safely fall back to defaults. Built-in modes are Build, Plan, and Fast.

## Entry points / commands

- `/login` and onboarding authenticate providers.
- `/models` opens model/pack selection and custom pack management (`mastracode/src/tui/commands/models-pack.ts:1`).
- `/mode` switches the current harness mode.
- Shift+Tab cycles modes while idle (`mastracode/src/tui/setup.ts:137`).
- Headless accepts `--model`, `--mode`, and `--thinking-level` (`mastracode/src/headless.ts:47`).

## TUI states

- Startup loads saved settings and provider access before creating harness modes and defaults (`mastracode/src/index.ts:520`).
- Built-in v1 modes are configured in `createMastraCode()`: build defaults to Anthropic Opus, plan defaults to OpenAI GPT, fast defaults to Cerebras (`mastracode/src/index.ts:479`).
- Mode/model changes refresh auth status through event dispatch (`mastracode/src/tui/event-dispatch.ts:136`).
- Model selector prompts for API keys if needed when a model is selected (`mastracode/src/tui/commands/models-pack.ts:72`).
- The TUI syncs thread active pack metadata on thread_created/thread_changed (`mastracode/src/tui/mastra-tui.ts:683`).

## Headless / non-TUI behavior

Headless resolves `--model` and `--mode` without interactive selectors. `--model` overrides mode defaults; `--mode` chooses one of build/plan/fast; `--thinking-level` controls provider reasoning settings where applicable (`mastracode/src/headless.ts:81`). Auth/model access still uses the same settings and `AuthStorage`-backed resolution path.

## Streaming / loading / interrupted states

- Mode switching is blocked while the agent is running or a plan approval is active (`mastracode/src/tui/setup.ts:137`).
- Model/mode changes happen between runs; active streaming should keep using the model selected for that run.
- `model_changed` and `mode_changed` events update auth/status projection, not message history (`mastracode/src/tui/event-dispatch.ts:136`).

## Streaming vs loaded-from-history behavior

During streaming, current model/mode state comes from the active harness session and is visible in the footer/status. Loaded-from-history/reload behavior depends on persisted thread/session metadata. `createMastraCode()` seeds v1 sessions from existing thread metadata (`currentModeId`, `currentModelId`) or falls back to mode defaults (`mastracode/src/index.ts:657`). If session state, thread metadata, and TUI footer projection diverge, the user may see “No model selected” or a footer mode that does not match prompt/runtime state.

## State ownership

- Current model ID: harness session is authoritative during runtime; thread metadata/session records must persist it for reload.
- Current mode ID: harness session is authoritative; mode defaults come from mode pack/settings.
- Provider credentials: `AuthStorage`/settings/env vars are authoritative; TUI prompts only collect/update them.
- Model packs/custom packs: settings are authoritative; thread active pack metadata can override per thread.
- Footer/model auth display: TUI projection from harness/model auth checker.
- Thinking level: harness state/settings are authoritative and included in dynamic prompt/model resolution.

## Key files

- `mastracode/src/index.ts` — provider access checks, mode defaults, session prefill from thread metadata, harness setup.
- `mastracode/src/agents/model.ts` — provider/model resolution and OAuth/API key routing.
- `mastracode/src/auth/storage.ts` — credential persistence and refresh.
- `mastracode/src/tui/commands/models-pack.ts` — `/models` UI and pack management.
- `mastracode/src/tui/commands/mode.ts` — `/mode` command.
- `mastracode/src/headless.ts` — `--model`, `--mode`, `--thinking-level` flags.

## Dependencies / related features

- [Persistent conversations](../threads/persistent-conversations.md) — reload preservation is thread/session metadata dependent.
- [Interactive TUI chat](../tui/interactive-chat.md) — active run model/mode drives streamed output.

## Existing tests

- `mastracode/src/agents/__tests__/model.test.ts` — model/provider resolution behavior.
- `mastracode/src/__tests__/codex-model-routing.test.ts` — Codex routing behavior.
- `mastracode/src/tui/commands/__tests__/models-pack.test.ts` — `/models` pack behavior.
- `mastracode/src/tui/commands/__tests__/mode.test.ts` — mode switching behavior.
- `mastracode/src/HarnessCompat.test.ts` — model/mode composition and preservation across thread switches.
- `mastracode/src/headless.test.ts` — headless model/mode parsing and resolution.

## Missing tests

- Reload regression test for “model pack selected, restart TUI, footer and runtime model agree.”
- Thread switch test proving current model preservation does not overwrite intentionally persisted per-thread model unexpectedly.
- Headless test for `--model` precedence over `--mode` after Harness v1 session migration.

## Known risks / regressions

- Slack reported “No model selected” after reload using model packs; this page should be updated when the exact fix/regression PR is mapped.
- PR #17411 / #17546 history suggests session-state composition was risky for model/mode state; verify all future edits against session/thread/TUI source-of-truth table.
- Env leakage caused existing `model.test.ts` failures in audit; isolate env in future tests before treating failures as product regressions.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
