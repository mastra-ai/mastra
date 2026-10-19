---
'@mastra/playground-ui': minor
---

`ProviderLogo` now draws bundled brand marks for common model makers instead of fetching them from models.dev.

The bundled marks cover:

- Anthropic (the Claude spark)
- Google (Gemini)
- OpenAI
- DeepSeek
- OpenRouter
- Qwen
- Mistral
- Z.ai
- NVIDIA
- MiniMax
- Meta
- Moonshot
- xAI

OpenRouter-style ids such as `mistralai`, `z-ai`, `meta-llama`, `x-ai` and `~anthropic` resolve to the same marks. The OpenAI, OpenRouter, Z.ai, Moonshot and xAI marks use the text color. Each mark is exported on its own path, for example `@mastra/playground-ui/icons/GeminiIcon`.

`ProviderLogo`'s `size` prop now also takes an icon size token. Prefer the token, because the logo then matches the icons around it. Pixel numbers still work, including for the fallback icons.

```tsx
<ProviderLogo providerId="anthropic" size="md" />
<ProviderLogo providerId="anthropic" size={32} />
```
