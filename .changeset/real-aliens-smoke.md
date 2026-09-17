---
'@mastra/code-sdk': patch
---

Improved Mastra Code settings storage. Preferences now use `~/.mastracode/config.json`, and durable state uses the operating system application-data directory. Existing `settings.json` files migrate automatically. Files passed with `--settings` remain combined. Mastra Code limits settings-file access to the current user on supported platforms.
