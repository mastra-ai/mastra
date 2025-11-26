---
'@mastra/core': patch
---

Adds ability to create custom `MastraModelGateway`'s that can be added to the `Mastra` class instance under the `gateways` property. Giving you typescript autocompletion in any model picker string.

```typescript
import { MastraModelGateway, type ProviderConfig } from '@mastra/core/llm';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModelV2 } from '@ai-sdk/provider';

class MyCustomGateway extends MastraModelGateway {
  readonly id = 'custom';
  readonly name = 'My Custom Gateway';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      'my-provider': {
        name: 'My Provider',
        models: ['model-1', 'model-2'],
        apiKeyEnvVar: 'MY_API_KEY',
        gateway: this.id,
      },
    };
  }

  buildUrl(modelId: string, envVars?: Record<string, string>): string {
    return 'https://api.my-provider.com/v1';
  }

  async getApiKey(modelId: string): Promise<string> {
    const apiKey = process.env.MY_API_KEY;
    if (!apiKey) throw new Error('MY_API_KEY not set');
    return apiKey;
  }

  async resolveLanguageModel({
    modelId,
    providerId,
    apiKey,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<LanguageModelV2> {
    const baseURL = this.buildUrl(`${providerId}/${modelId}`);
    return createOpenAICompatible({
      name: providerId,
      apiKey,
      baseURL,
    }).chatModel(modelId);
  }
}

new Mastra({
  gateways: {
    myGateway: new MyCustomGateway(),
  },
});
```
