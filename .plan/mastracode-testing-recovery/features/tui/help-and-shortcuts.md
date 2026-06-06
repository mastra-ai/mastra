# Help and shortcuts

## Origin PR / commit

- PR: [#13426](https://github.com/mastra-ai/mastra/pull/13426) — replaced the old verbose `/help` output with a compact command/shortcut reference.
- Later changes: [#13487](https://github.com/mastra-ai/mastra/pull/13487) — added `/theme` to the command surface/help list; [#13787](https://github.com/mastra-ai/mastra/pull/13787) — added `/update` to the command surface/help list; [#13605](https://github.com/mastra-ai/mastra/pull/13605) — added `/report-issue` to the command surface/help list; [#13682](https://github.com/mastra-ai/mastra/pull/13682) — added `/custom-providers` to the command surface/help list; [#13690](https://github.com/mastra-ai/mastra/pull/13690) — lists `/resource` as resource switching help; [#13712](https://github.com/mastra-ai/mastra/pull/13712) — adds Ctrl+V / Alt+V clipboard paste to the editor shortcut surface; [#13723](https://github.com/mastra-ai/mastra/pull/13723) — changes Ctrl+Z to process suspend and moves undo-last-clear to Alt+Z; [#14250](https://github.com/mastra-ai/mastra/pull/14250) — changed the keyboard shortcut list to show `Enter` as send and `Ctrl+F` as queue follow-up; [#15036](https://github.com/mastra-ai/mastra/pull/15036) — added `/browser` to the command surface/help list; [#15014](https://github.com/mastra-ai/mastra/pull/15014) — added `/api-keys` to the slash-command surface for provider credential management; [#15642](https://github.com/mastra-ai/mastra/pull/15642) — adds `/observability` to the command/help surface while `/feedback` is dispatchable but not listed in the compact help text on current source.

## User-visible behavior

- What the user can do: run `/help` to see core slash commands, including `/browser`, `/api-keys`, and `/observability`, custom `//commands`, shell passthrough, and keyboard shortcuts including `Enter` send and `Ctrl+F` queue follow-up.
- Success looks like: help is short enough to scan, hides `/mode` / `⇧+Tab` when only one mode exists, shows custom commands with `//` prefixes, lists browser configuration, and matches the current queueing shortcut surface.
- Must preserve: startup header hint points users to `/help` for details instead of dumping command lists in the banner.

## Entry points / commands

- Commands / shortcuts / flags: `/help`; startup hint line shows `/help info & shortcuts`; editor shortcuts include Ctrl+Z process suspend, Alt+Z undo-last-clear, and Ctrl+V / Alt+V paste.
- Automatic triggers: none; help text is built on demand from current harness modes, custom slash commands, and shell passthrough settings.

## TUI states

- Idle: `/help` renders via `ctx.showInfo()`.
- Active / modal / error: slash-command execution path decides whether `/help` can run; this card covers the rendered text only.

## Headless / non-TUI behavior

- Supported: no dedicated headless help renderer verified.
- Not supported / unknown: parity between `/help` in TUI and any non-interactive command-list output.

## Streaming / loading / interrupted states

- Streaming / loading: help output is static command text, not model-streamed content.
- Abort / retry / resume: no persisted runtime state.

## Streaming vs loaded-from-history behavior

- While actively streaming: no active streaming projection.
- After reload / history reconstruction: previous `/help` output can exist as chat history, but current command availability is recomputed when `/help` is run again.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Help command list | `buildHelpText()` hardcoded entries + `ctx.harness.listModes()` | `/help` command, including `/theme`, `/update`, `/report-issue`, `/custom-providers`, `/resource`, `/mcp`, `/browser`, `/api-keys`, `/observability`, Enter send, Ctrl+F queue, Ctrl+Z suspend, and Alt+Z undo |
| Custom commands | `SlashCommandContext.customSlashCommands` | Help text custom section |
| Shell passthrough label | Global settings + shell resolver | Help text shell section |
| Startup hint | `buildLayout()` | TUI startup header |

## Key files

- `mastracode/src/tui/commands/help.ts` — `/help` handler and shell/mode context wiring.
- `mastracode/src/tui/components/help-overlay.ts` — compact help text builder.
- `mastracode/src/tui/components/__tests__/help-overlay.test.ts` — help-text assertions.
- `mastracode/src/tui/setup.ts` — startup hint changed to `⇧+Tab cycle modes` + `/help info & shortcuts`.

## Dependencies / related features

- [Interactive TUI chat](./interactive-chat.md) — `/help` renders inside chat.
- [Startup banner](./startup-banner.md) — banner/header now delegates command details to `/help`.
- [Terminal theme and contrast](./terminal-theme.md) — `/theme` command is listed here.
- [Auto-update prompts](../setup/auto-update-prompts.md) — `/update` command is listed here.
- [GitHub issue reporting command](../integrations/github-issue-reporting.md) — `/report-issue` command is listed here.
- [Custom OpenAI-compatible providers](../models/custom-providers.md) — `/custom-providers` command is listed here.
- [Resource ID switching](../threads/resource-id-switching.md) — `/resource` command is listed here.
- [MCP server configuration](../integrations/mcp-server-configuration.md) — `/mcp` command is listed here.
- [Browser automation](../integrations/browser-automation.md) — `/browser` command is listed here.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — `/api-keys` command is listed here.
- [Observability and eval feedback](../integrations/observability-and-evals.md) — `/observability` is listed here; `/feedback` dispatch exists but is not listed in current compact help.
- [Clipboard paste](./clipboard-paste.md) — Ctrl+V / Alt+V behavior is part of the editor shortcut surface.
- [Process suspend shortcut](./process-suspend.md) — Ctrl+Z and Alt+Z behavior is part of the shortcut list.
- [Queued follow-ups and slash commands](../chat/queued-followups.md) — slash command dispatch executes `/help`.

## Existing tests

- `mastracode/src/tui/components/__tests__/help-overlay.test.ts` — command list, shell section, shortcuts, mode-gated `/mode`/`⇧+Tab`, and custom `//command` rendering.
- `mastracode/src/tui/commands/__tests__/help.test.ts` — direct `/help` handler coverage proving `ctx.showInfo()` receives real help text from harness mode count, custom slash commands, shell passthrough settings, current shortcut labels, `/api-keys`, `/observability`, and intentional `/feedback` omission.
- `mastracode/src/tui/__tests__/setup-layout.test.ts` — startup header hint remains visible and mode-aware with/without multiple modes.

## Missing tests

- Broader e2e command dispatch test proving `/help` renders in the live TUI transcript. Deferred because the direct handler now verifies the real `SlashCommandContext` data boundary without model/network dependence.

## Known risks / regressions

- Command/shortcut list is manually maintained and can drift from registered commands/keys, including `/theme`, `/update`, `/report-issue`, `/custom-providers`, `/resource`, `/mcp`, `/browser`, `/api-keys`, `/observability`, `/feedback`, Ctrl+Z, Alt+Z, and provider-specific subcommands.
- Custom slash commands are listed, but command namespace collisions or hidden commands are not modeled by the help builder.
- Headless/non-TUI help parity is unverified.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
