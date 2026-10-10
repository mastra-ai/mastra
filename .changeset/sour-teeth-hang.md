---
'mastracode': minor
---

Added a `--pack <id>` startup flag to the interactive TUI. It accepts a builtin pack id (`anthropic`, `openai`, `github-copilot`) or a saved custom pack by `custom:<name>` or bare name, fails fast on unknown ids with the list of valid packs, and applies the pack to the started session like `/models` → Activate does — mode models, subagent models, model route, and thread pack metadata — also becoming the global default pack. `--pack` takes precedence over `MASTRACODE_MODEL_ID`.

**Example**

```bash
mastracode --pack anthropic
mastracode --pack custom:Kimi
mastracode --pack Kimi
```
