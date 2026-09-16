---
'@mastra/core': patch
---

Exported `GatewayManager` from `@mastra/core/llm` and added `ModelRouterLanguageModel.hasAuth()` to check credentials through the model's gateway chain. Available-model listings now check authentication for each model, so a gateway that authenticates one model doesn't mark every model from its provider as authenticated.

```typescript
import { GatewayManager } from '@mastra/core/llm';
import { mastra } from './mastra';

const gateways = new GatewayManager(Object.values(mastra.listGateways() ?? {}));
const hasAuth = await gateways.hasAuth('openai/gpt-5.6-sol');
```
