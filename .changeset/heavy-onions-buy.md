---
'@mastra/core': patch
---

Fix model headers not being passed through gateway system

Previously, custom headers specified in `MastraModelConfig` were not being passed through the gateway system to model providers. This affected:
- OpenRouter (preventing activity tracking with `HTTP-Referer` and `X-Title`)
- Custom providers using custom URLs (headers not passed to `createOpenAICompatible`)
- Custom gateway implementations (headers not available in `resolveLanguageModel`)

Now headers are correctly passed through the entire gateway system:
- Base `MastraModelGateway` interface updated to accept headers
- `ModelRouterLanguageModel` passes headers from config to all gateways
- OpenRouter receives headers for activity tracking
- Custom URL providers receive headers via `createOpenAICompatible`
- Custom gateways can access headers in their `resolveLanguageModel` implementation

Example usage:
```typescript
// Works with OpenRouter
const agent = new Agent({
  name: 'my-agent',
  instructions: 'You are a helpful assistant.',
  model: {
    id: 'openrouter/anthropic/claude-3-5-sonnet',
    headers: {
      'HTTP-Referer': 'https://myapp.com',
      'X-Title': 'My Application',
    },
  },
});

// Also works with custom providers
const customAgent = new Agent({
  name: 'custom-agent',
  instructions: 'You are a helpful assistant.',
  model: {
    id: 'custom-provider/model',
    url: 'https://api.custom.com/v1',
    apiKey: 'key',
    headers: {
      'X-Custom-Header': 'custom-value',
    },
  },
});
```

Fixes https://github.com/mastra-ai/mastra/issues/9760
