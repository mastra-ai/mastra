---
'@mastra/core': minor
---

Added per-entry `modelSettings`, `providerOptions`, and `headers` to agent model fallback arrays. Each entry can now specify its own temperature, topP, provider-specific options, and HTTP headers — either statically or as a function of `requestContext`. Closes #15421.

**Example**

```ts
const agent = new Agent({
  model: [
    {
      model: 'google/gemini-2.5-flash',
      maxRetries: 2,
      modelSettings: { temperature: 0.3 },
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    },
    {
      model: 'openai/gpt-5-mini',
      maxRetries: 2,
      modelSettings: { temperature: 0.7 },
      providerOptions: { openai: { reasoningEffort: 'low' } },
    },
  ],
});
```

**Precedence** (lowest → highest): agent `defaultOptions` → call-time `stream()` / `generate()` options → per-fallback entry. `modelSettings` and `headers` shallow-merge by key; `providerOptions` deep-merges per provider key.
