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

**Precedence**:

- `modelSettings` and `providerOptions`: per-fallback entry > call-time `stream()` / `generate()` options > agent `defaultOptions`. `modelSettings` shallow-merges by key; `providerOptions` deep-merges recursively, preserving sibling and nested keys.
- `headers`: call-time `modelSettings.headers` > per-fallback `headers` > model-router-extracted headers. This preserves the existing Mastra contract from #11275, where runtime headers (typically tracing, auth, tenancy) intentionally override model-level headers.
