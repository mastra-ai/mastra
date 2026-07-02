---
'@mastra/core': minor
---

Agents using models that dropped support for `temperature`, `topP`, or `topK` (such as `claude-opus-4-7` or `gpt-5-pro`) no longer crash with a 400 error. The model router now automatically strips unsupported sampling parameters before the request is sent — no configuration or processors needed.

```ts
const agent = new Agent({
  model: 'anthropic/claude-opus-4-7',
  instructions: 'You are a helpful assistant.',
});

// temperature is stripped automatically — no 400 error
await agent.generate('hello', { modelSettings: { temperature: 0.7 } });
```
