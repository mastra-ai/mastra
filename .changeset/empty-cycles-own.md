---
'@mastra/code-sdk': minor
---

Added a `--pack <id>` flag to headless mode (`mastracode -p ... --pack anthropic`). It resolves builtin pack ids and saved custom packs (`custom:<name>` or bare name), exits with the list of valid packs on unknown ids, and applies the pack like `/models` → Activate: mode models, subagent models, model route, and thread `activeModelPackId`. An explicit `--model` still wins over the pack for the active mode.

**Example**

```bash
mastracode -p "summarize this repo" --pack anthropic
mastracode -p "fix the tests" --pack Kimi --model openai/gpt-5.5
```
