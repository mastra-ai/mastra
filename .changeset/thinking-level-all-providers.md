---
'@mastra/code-sdk': patch
---

The `/think` thinking level now applies to Gemini, custom OpenAI-compatible providers, and OpenAI API-key models, not just Anthropic and OpenAI Codex. Previously these models silently ignored it.

```
/think high
```

Gemini and OpenAI API-key models map the level to what each model supports. Custom OpenAI-compatible providers receive the selected level unchanged, including `xhigh` and `max`. With thinking `off` (the default), requests are unchanged.
