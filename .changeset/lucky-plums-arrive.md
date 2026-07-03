---
'@mastra/mcp-registry-registry': patch
---

Add Remote OpenClaw to the registry list

```ts
import { getRegistryListings } from '@mastra/mcp-registry-registry';

const result = await getRegistryListings({ id: 'remoteopenclaw' }, { detailed: true });
console.log(result.registries[0].url); // https://www.remoteopenclaw.com/
```
