---
'@mastra/code-sdk': patch
---

The `/think` thinking level now applies to Gemini, custom OpenAI-compatible providers, and OpenAI API-key models, not just Anthropic and OpenAI Codex. Previously these models silently ignored it.

```
/think high
```

Levels a provider doesn't support are clamped to its closest supported level. With thinking `off` (the default), requests are unchanged.
