---
'@mastra/core': patch
'@mastra/evals': patch
---

`ExpectedStep` now supports `provider_tool_call` steps, so you can write typed trajectory expectations for provider-executed tools such as web search. The trajectory scorer compares their `toolArgs`, `toolResult`, and `success` fields.

```ts
const steps: ExpectedStep[] = [{ name: 'web_search', stepType: 'provider_tool_call', toolArgs: { query: 'weather' } }];
```
