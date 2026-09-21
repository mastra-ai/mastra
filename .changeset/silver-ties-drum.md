---
'@mastra/core': minor
---

Added an `api` option to custom OpenAI-compatible model configs so a custom `url` can target the OpenAI Responses API. Set `api: "responses"` alongside `url` to reach `/v1/responses` (for example to combine function tools with reasoning models on gateways that require it); it defaults to `"chat"`, so existing configurations are unchanged.

```typescript
const agent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: 'You are a helpful assistant',
  model: {
    id: 'custom/my-model',
    url: 'https://your-endpoint.com/v1',
    api: 'responses',
  },
});
```
