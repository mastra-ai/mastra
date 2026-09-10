---
'@mastra/core': minor
---

Added an `api` option to custom OpenAI-compatible model configs so a custom `url` can be called through the OpenAI Responses API instead of Chat Completions.

Custom `url` configs always sent requests to `{url}/chat/completions`. Some gateways only serve certain models, or features such as function tools combined with a reasoning effort, through `{url}/responses`. For example, Databricks AI Gateway rejects tool calls with any `reasoning_effort` other than `none` on Chat Completions, which forced tool-using agents to run with reasoning disabled. Set `api: 'responses'` to opt in; the default stays `'chat'`, so existing configs are unchanged.

```ts
const agent = new Agent({
  name: 'supervisor',
  model: {
    id: 'databricks/system.ai.gpt-5-6-luna',
    url: 'https://<workspace>.cloud.databricks.com/ai-gateway/openai/v1',
    apiKey: process.env.GATEWAY_PAT,
    api: 'responses',
  },
  defaultOptions: {
    providerOptions: {
      openai: { reasoningEffort: 'high', store: false, include: ['reasoning.encrypted_content'] },
    },
  },
});
```

Note that the Responses model reads provider options from `providerOptions.openai`, while the Chat Completions model reads `providerOptions['openai-compatible']` or your provider id. Fixes https://github.com/mastra-ai/mastra/issues/22656
