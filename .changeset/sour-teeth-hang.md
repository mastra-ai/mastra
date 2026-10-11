---
'mastracode': minor
---

Added a `--pack <id>` startup flag to the interactive TUI. It accepts a builtin pack id (`anthropic`, `openai`, `github-copilot`) or a saved custom pack by `custom:<name>` or bare name. Unknown ids fail fast with the list of valid packs. Startup uses the pack's models for the session and saves the pack as the global default. `--pack` takes precedence over `MASTRACODE_MODEL_ID`.

**Example**

```bash
mastracode --pack anthropic
mastracode --pack custom:Kimi
mastracode --pack Kimi
```
