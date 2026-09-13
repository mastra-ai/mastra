---
'@mastra/core': patch
---

Fixed `maxProcessorRetries` having no effect on `structuredOutput` when a separate structuring `model` is configured. A schema validation failure under the default `strict` strategy now asks the agent loop to retry the step with the validation error as feedback, and the structuring pass runs again on the new response. When `maxProcessorRetries` is unset or exhausted the run still ends with a tripwire, which is now raised from `processOutputStep` so its reason is reported once instead of nested twice.

```ts
const result = await agent.generate('Summarize the directory.', {
  maxProcessorRetries: 2,
  structuredOutput: { schema, model: 'openai/gpt-5-mini' },
});
// result.object is populated after a retry; previously the run ended with a tripwire on the first failure
```
