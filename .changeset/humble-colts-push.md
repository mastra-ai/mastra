---
'@mastra/code-sdk': minor
---

Added generateThreadTitle for one-off thread titles with a cheap side model, plus resolveDefaultThreadTitleModel which picks the first provider with credentials (Anthropic Haiku, then OpenAI GPT-5.6-Luna at low thinking). Both resolve through the mastracode gateway, so stored OAuth/API keys and env fallbacks work.

```ts
const title = await generateThreadTitle({ prompt: firstUserMessage });
```
