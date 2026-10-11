---
'mastracode': minor
---

Added a `--pack <id>` startup flag to the interactive TUI. It accepts a builtin pack id (`anthropic`, `openai`, `github-copilot`) or a saved custom pack by `custom:<name>` or bare name. Unknown ids fail fast with the list of valid packs. The pack applies to the started session like `/models` → Activate: mode models, subagent models, model route, and thread pack metadata. It also becomes the global default pack. `--pack` takes precedence over `MASTRACODE_MODEL_ID`.

**Example**

```bash
mastracode --pack anthropic
mastracode --pack custom:Kimi
mastracode --pack Kimi
```
