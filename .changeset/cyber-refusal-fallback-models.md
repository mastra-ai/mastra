---
'@mastra/core': minor
---

`CyberRefusalHandler` can now fall back to other models when a cybersecurity refusal survives its retry. Pass `fallbackModels` as a list, or as a function that picks a model when the refusal happens, and register the handler in `inputProcessors` too. The fallback lasts for the rest of the run; the next run starts on the agent's own model.

With no `fallbackModels` (or `'auto'`), a handler registered in `inputProcessors` switches models the provider itself routes cyber refusals for: Claude Fable 5 / 5.1 and Opus 5.5 → Opus 4.8, Sonnet 5.5 → Sonnet 5, GPT-5.3-Codex → GPT-5.2. Other models, and handlers registered only in the output and error lanes, behave as before. The table is exported as `CYBER_REFUSAL_AUTO_FALLBACKS`.

```ts
const cyberRefusals = new CyberRefusalHandler({ fallbackModels: ['anthropic/claude-sonnet-4-5'] });

new Agent({
  // ...
  inputProcessors: [cyberRefusals],
  errorProcessors: [cyberRefusals],
  outputProcessors: [cyberRefusals],
  maxProcessorRetries: 5,
});
```
