---
'@mastra/core': minor
---

Added `providerOptionsMode` to model fallback entries. Set it to `'replace'` so an entry sends only its own `providerOptions` instead of deep-merging them onto the call-level ones. Before, call-level options tuned for the primary model (such as a provider routing order) were always forwarded to every fallback, and a fallback on another vendor could reject them. Works for regular and durable agents. Fixes [#24431](https://github.com/mastra-ai/mastra/issues/24431).

```ts
const agent = new Agent({
  model: [
    { model: 'openai/gpt-5.6-sol', maxRetries: 2 },
    {
      model: 'anthropic/claude-sonnet-4-6',
      maxRetries: 2,
      providerOptionsMode: 'replace', // default: 'merge'
      providerOptions: { anthropic: { sendReasoning: false } },
    },
  ],
});

// Reaches the OpenAI entry only
await agent.generate('Hello', { providerOptions: { openai: { reasoningEffort: 'high' } } });
```
