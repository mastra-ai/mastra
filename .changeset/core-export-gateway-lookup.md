---
'@mastra/core': patch
---

Export `findGatewayForModel` and `getGatewayId` from `@mastra/core/llm` so callers can check which registered gateway the model router would pick for a model ID.

```ts
import { findGatewayForModel, getGatewayId } from '@mastra/core/llm';

const gateway = findGatewayForModel('acme/fast-1', Object.values(mastra.listGateways() ?? {}));
console.log(getGatewayId(gateway));
```
