---
'mastracode': minor
---

Added `--model`, `--mode`, `--thinking-level`, and `--settings` CLI flags to headless mode for controlling model selection, execution mode, and thinking level without interactive TUI. Uses the same `settings.json` as the interactive TUI — pass `--settings <path>` for CI or other environments, or omit to use the default global settings. Added `settingsPath` option to `createMastraCode()` for programmatic use.
