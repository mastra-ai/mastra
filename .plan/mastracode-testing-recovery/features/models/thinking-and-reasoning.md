# Thinking and reasoning effort

## Origin PR / commit

- PR: [#13490](https://github.com/mastra-ai/mastra/pull/13490) — wire Mastra Code thinking settings into OpenAI Codex reasoning effort.
- Later changes: [#13563](https://github.com/mastra-ai/mastra/pull/13563) — made Codex reasoning/middleware compatible with OM model resolution and Mastra Code streams; [#13748](https://github.com/mastra-ai/mastra/pull/13748) — persists `/think`, Settings UI, and OpenAI pack auto-bump changes to the global thinking preference.

## User-visible behavior

- What the user can do: set reasoning depth with `/think`, `/think <level>`, `/think status`, `/settings`, or `--thinking-level`.
- Success looks like: OpenAI Codex/GPT-5 OAuth requests include the intended `reasoningEffort`, and the selected level persists across restarts via global settings.
- Must preserve: levels `off`, `low`, `medium`, `high`, `xhigh`; GPT-5 Codex minimum of `low`; warning-only behavior for models that may not support thinking.

## Entry points / commands

- Commands / shortcuts / flags: `/think`, `/think low|medium|high|xhigh|off`, `/think status`, `/settings` thinking-level selector, `--thinking-level`.
- Automatic triggers: activating an OpenAI-heavy model pack auto-sets thinking to `low` when the current value is `off`, and persists that bump.

## TUI states

- Idle: `/think` opens an inline selector; direct args and `/settings` changes update harness state and global settings immediately.
- Active / modal / error: selector warns for non-OpenAI models but still allows the persisted choice; invalid args list valid levels.

## Headless / non-TUI behavior

- Supported: headless parser accepts `--thinking-level` and passes it into initial state.
- Not supported / unknown: no headless warning if the selected model ignores reasoning effort.

## Streaming / loading / interrupted states

- Streaming / loading: runtime and OM model resolution read `thinkingLevel` from harness request context before building the provider.
- Abort / retry / resume: thinking is between-run state; changing it should affect the next model resolution, not mutate already-started streams.

## Streaming vs loaded-from-history behavior

- While actively streaming: Codex middleware injects `providerOptions.openai.reasoningEffort`, `instructions`, and `store: false` for the selected level/path.
- After reload / history reconstruction: `settings.preferences.thinkingLevel` and harness state seed the next session/run.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Thinking level | Harness state + `settings.preferences.thinkingLevel` | `/think`, `/settings`, `/models`, headless startup, model resolver |
| Codex effective level | `getEffectiveThinkingLevel()` + request-context state | OpenAI Codex OAuth provider, OM observer/reflector models |
| Provider value labels | `getThinkingLevelsForModel()` | `/think` selector, settings UI |

## Key files

- `mastracode/src/tui/commands/think.ts` — command/selector behavior and global preference persistence.
- `mastracode/src/providers/openai-codex.ts` — `ThinkingLevel`, `reasoningEffort` mapping, GPT-5 minimum, Codex fetch/middleware request shaping.
- `mastracode/src/agents/model.ts` — reads `thinkingLevel` from request context, remaps Codex OAuth models when requested, and passes it into Codex resolution.
- `mastracode/src/tui/components/thinking-settings.ts` — level labels and provider values.
- `mastracode/src/tui/commands/models-pack.ts` — OpenAI pack auto-enables and persists low thinking.
- `mastracode/src/tui/commands/settings.ts` — Settings UI writes thinking-level changes back to `settings.json`.

## Dependencies / related features

- [Model auth, selection, and modes](./model-auth-and-modes.md) — selected model/provider determines whether thinking takes effect.
- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — persists global thinking preference.

## Existing tests

- `mastracode/src/__tests__/codex-model-routing.test.ts` — GPT-5 Codex remapping and low-minimum thinking behavior.
- `mastracode/src/agents/__tests__/model.test.ts` — dynamic model resolution passes `thinkingLevel` into OpenAI Codex provider.
- `mastracode/src/providers/__tests__/openai-codex-fetch.test.ts` — Codex provider factory/base URL and middleware request-shape coverage for `reasoningEffort`, `instructions`, `store: false`, preserved provider options, and `topP` removal.
- `mastracode/src/headless.test.ts` — `--thinking-level` parsing.
- `mastracode/src/onboarding/__tests__/settings.test.ts` — global settings schema includes thinking preference.

## Missing tests

- `/think` selector/direct-argument command test, including invalid arg, non-OpenAI warning behavior, and settings persistence.
- `/settings` thinking-level persistence test.
- `/models` OpenAI pack activation test that verifies `off` auto-upgrades to `low` and writes `settings.preferences.thinkingLevel`.
- Covered: provider request-shape test asserts `reasoningEffort`, `instructions`, `store: false`, preserved existing provider options, and `topP` removal land in Codex `providerOptions` (`mastracode/src/providers/__tests__/openai-codex-fetch.test.ts`).

## Known risks / regressions

- Current `supportsThinking()` is provider-prefix based (`openai/`), so future non-OpenAI reasoning providers need explicit expansion.
- OpenAI/Codex model defaults drift over time; tests should avoid hard-coding stale default IDs unless testing migration behavior.
- Turning thinking `off` still becomes `low` for GPT-5 Codex models by design.
- OM model calls must keep the same request-context state as normal chat model calls; otherwise Codex OAuth can lose reasoning/tool-call behavior only inside memory.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.

## TUI e2e recovery evidence

- Covered by `state-commands`, which asserts `/think status` through the real TUI. Provider request-shape reasoning effort remains covered by focused provider tests.
- Verification: `state-commands`, full e2e `--jobs 2`, check, lint, and build passed.
