# Thinking and reasoning effort

## Origin PR / commit

- PR: [#13490](https://github.com/mastra-ai/mastra/pull/13490) — wire Mastra Code thinking settings into OpenAI Codex reasoning effort.
- Later changes: none known.

## User-visible behavior

- What the user can do: set reasoning depth with `/think`, `/think <level>`, `/think status`, or `--thinking-level`.
- Success looks like: OpenAI Codex/GPT-5 OAuth requests include the intended `reasoningEffort`, so models use tools instead of only narrating.
- Must preserve: levels `off`, `low`, `medium`, `high`, `xhigh`; GPT-5 Codex minimum of `low`; warning-only behavior for models that may not support thinking.

## Entry points / commands

- Commands / shortcuts / flags: `/think`, `/think low|medium|high|xhigh|off`, `/think status`, `--thinking-level`.
- Automatic triggers: activating an OpenAI model pack auto-sets thinking to `low` when the current value is `off`.

## TUI states

- Idle: `/think` opens an inline selector; direct args update harness state and global settings immediately.
- Active / modal / error: selector warns for non-OpenAI models but still allows the persisted choice; invalid args list valid levels.

## Headless / non-TUI behavior

- Supported: headless parser accepts `--thinking-level` and passes it into initial state.
- Not supported / unknown: no headless warning if the selected model ignores reasoning effort.

## Streaming / loading / interrupted states

- Streaming / loading: runtime model resolution reads `thinkingLevel` from harness request context before building the provider.
- Abort / retry / resume: thinking is between-run state; changing it should affect the next model resolution, not mutate already-started streams.

## Streaming vs loaded-from-history behavior

- While actively streaming: Codex middleware injects `providerOptions.openai.reasoningEffort` for the selected level.
- After reload / history reconstruction: `settings.preferences.thinkingLevel` and harness state seed the next session/run.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Thinking level | Harness state + `settings.preferences.thinkingLevel` | `/think`, `/models`, headless startup, model resolver |
| Codex effective level | `getEffectiveThinkingLevel()` | OpenAI Codex OAuth provider |
| Provider value labels | `getThinkingLevelsForModel()` | `/think` selector, settings UI |

## Key files

- `mastracode/src/tui/commands/think.ts` — command/selector behavior.
- `mastracode/src/providers/openai-codex.ts` — `ThinkingLevel`, `reasoningEffort` mapping, GPT-5 minimum.
- `mastracode/src/agents/model.ts` — reads `thinkingLevel` from request context and passes it into Codex resolution.
- `mastracode/src/tui/components/thinking-settings.ts` — level labels and provider values.
- `mastracode/src/tui/commands/models-pack.ts` — OpenAI pack auto-enables low thinking.

## Dependencies / related features

- [Model auth, selection, and modes](./model-auth-and-modes.md) — selected model/provider determines whether thinking takes effect.
- [Onboarding and global settings](../settings/onboarding-and-global-settings.md) — persists global thinking preference.

## Existing tests

- `mastracode/src/__tests__/codex-model-routing.test.ts` — GPT-5 Codex remapping and low-minimum thinking behavior.
- `mastracode/src/agents/__tests__/model.test.ts` — dynamic model resolution passes `thinkingLevel` into OpenAI Codex provider.
- `mastracode/src/headless.test.ts` — `--thinking-level` parsing.
- `mastracode/src/onboarding/__tests__/settings.test.ts` — global settings schema includes thinking preference.

## Missing tests

- `/think` selector/direct-argument command test, including invalid arg and non-OpenAI warning behavior.
- `/models` OpenAI pack activation test that verifies `off` auto-upgrades to `low`.
- Provider request-shape test that asserts `reasoningEffort` lands in Codex `providerOptions`.

## Known risks / regressions

- Current `supportsThinking()` is provider-prefix based (`openai/`), so future non-OpenAI reasoning providers need explicit expansion.
- OpenAI/Codex model defaults drift over time; tests should avoid hard-coding stale default IDs unless testing migration behavior.
- Turning thinking `off` still becomes `low` for GPT-5 Codex models by design.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
