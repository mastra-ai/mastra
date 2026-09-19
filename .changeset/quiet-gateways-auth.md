---
'@mastra/core': minor
---

Expose the native `GatewayManager` and its model entry type from `@mastra/core/llm` for gateway authentication preflight checks.

```ts
import { GatewayManager, defaultGateways, type GatewayModel } from '@mastra/core/llm'

const manager = new GatewayManager(defaultGateways)
const modelId: GatewayModel['id'] = 'google/gemini-2.5-pro'
const ready: boolean = await manager.hasAuth(modelId)
```
