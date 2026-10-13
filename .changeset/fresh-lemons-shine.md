---
'@mastra/core': minor
---

Added an optional `pricing` field to gateway provider configs. A custom gateway can now state what its models cost, in USD per 1 million tokens with the same keys as models.dev, so calls to private or reseller models get cost estimates.

```ts
async fetchProviders() {
  return {
    'my-provider': {
      name: 'My Provider',
      models: ['model-1'],
      apiKeyEnvVar: 'MY_API_KEY',
      gateway: 'private',
      url: 'https://api.myprovider.com/v1',
      pricing: { 'model-1': { input: 0.5, output: 1.5 } },
    },
  };
}
```
