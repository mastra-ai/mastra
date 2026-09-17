---
'@mastra/core': minor
---

Added optional `hasProviderCredentials(providerId)` to model gateways so provider catalogs can read local credential presence without refreshing tokens or checking individual models. The built-in Mastra and Azure gateways report credentials supplied through their constructors.

Exported `GatewayManager` from `@mastra/core/llm` to query registered gateways. Added `ModelRouterLanguageModel.hasAuth()` to check authentication through an existing model's explicit credentials and gateway chain.

```typescript
import { GatewayManager } from '@mastra/core/llm';
import { mastra } from './mastra';

const gateways = new GatewayManager(Object.values(mastra.listGateways() ?? {}));
const connected = gateways.hasProviderCredentials('openai');
```
