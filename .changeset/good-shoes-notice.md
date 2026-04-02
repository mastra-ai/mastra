---
'mastracode': minor
---

Replaced `--config` and `--profile` headless flags with `--settings <path>`. Uses the same `settings.json` as the interactive TUI — pass a custom path for CI or other environments, or omit to use the default global settings. Added `settingsPath` option to `createMastraCode()` for programmatic use.
