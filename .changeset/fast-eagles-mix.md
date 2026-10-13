---
'@mastra/core': patch
---

xAI models now accept `xhigh` reasoning effort. Groq, xAI, Together AI, DeepInfra, Cerebras and Alibaba models now run on the AI SDK v7 provider packages, like DeepSeek.

```ts
await agent.generate('Prove that there are infinitely many primes.', {
  providerOptions: { xai: { reasoningEffort: 'xhigh' } },
});
```
