---
'@mastra/core': minor
---

`CyberRefusalHandler` can now fall back to other models when a cybersecurity refusal survives its retry. Pass `fallbackModels` as a list, or as a function that picks a model when the refusal happens, and register the handler in `inputProcessors` too. The fallback lasts for the rest of the run; the next run starts on the agent's own model.

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
