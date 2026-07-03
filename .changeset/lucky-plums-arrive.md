---
'@mastra/mcp-registry-registry': patch
---

Add Remote OpenClaw to the registry list

```ts
import { registryData } from '@mastra/mcp-registry-registry';

const remoteOpenClaw = registryData.registries.find(r => r.id === 'remoteopenclaw');
console.log(remoteOpenClaw?.url); // https://www.remoteopenclaw.com/
```
