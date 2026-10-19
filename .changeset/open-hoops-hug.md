---
'@mastra/playground-ui': minor
---

`ProviderLogo` now draws bundled brand marks for the most common model makers instead of fetching them from models.dev: Anthropic (the Claude spark), Google (Gemini), OpenAI, DeepSeek, OpenRouter, Qwen, Mistral, Z.ai, NVIDIA, MiniMax, Meta, Moonshot and xAI. OpenRouter-style ids such as `mistralai`, `z-ai`, `meta-llama`, `x-ai` and `~anthropic` resolve to the same marks. The OpenAI, OpenRouter, Z.ai, Moonshot and xAI marks use the text color. The new marks are exported from `@mastra/playground-ui/icons`.

`ProviderLogo`'s `size` prop now also takes an icon size token, which is the preferred form because the logo then matches the icons around it. Pixel numbers still work.

```tsx
<ProviderLogo providerId="anthropic" size="md" />
<ProviderLogo providerId="anthropic" size={32} />
```
