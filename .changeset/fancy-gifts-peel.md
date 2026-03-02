---
'@mastra/core': minor
---

Added `toolsets` option to `HarnessConfig` for injecting provider-scoped tool groups (e.g., Anthropic native web search, OpenAI web search). The function receives the current model ID automatically, making it easy to return the right toolsets per provider.

**Example usage:**

```ts
const harness = new Harness({
  toolsets: modelId => {
    if (modelId.startsWith('anthropic/')) return { anthropic: { web_search: anthropic.tools.webSearch_20250305() } };
    if (modelId.startsWith('openai/')) return { openai: { web_search: openai.tools.webSearch() } };
  },
});
```
