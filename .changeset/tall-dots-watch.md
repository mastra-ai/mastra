---
'@mastra/core': minor
'mastracode': patch
---

Added interface-first model gateways while keeping the existing `MastraModelGateway` base class backwards compatible.

Added `MastraModelGatewayInterface` for plain object/custom gateway implementations and optional gateway `resolveAuth` hooks.

Moved MastraCode gateway-routed OAuth model construction into a custom Mastra gateway so `ModelRouterLanguageModel` can route through gateway `resolveAuth` and provider-specific `resolveLanguageModel` behavior.

**Usage:**

```typescript
import { MastraModelGatewayInterface, ModelRouterLanguageModel } from '@mastra/core/llm';

const myGateway: MastraModelGatewayInterface = {
  id: 'my-gateway',
  name: 'My Gateway',
  async fetchProviders() { return {}; },
  buildUrl() { return 'https://api.example.com'; },
  async getApiKey() { return process.env.API_KEY ?? ''; },
  // Optional: own authentication lookup
  async resolveAuth(request) {
    return { apiKey: process.env.API_KEY, source: 'gateway' };
  },
  async resolveLanguageModel({ modelId, providerId, apiKey }) {
    // Return an AI SDK language model instance
  },
};

// Register and route through the gateway
const router = new ModelRouterLanguageModel({ modelId: 'my-gateway/provider/model' }, [myGateway]);
```
