---
'@mastra/datadog': major
---

Upgraded the Datadog bridge to dd-trace 6. Applications must run Node.js 22.13.0 or newer. Datadog v6 aligns LLMObs resource names across OpenAI v3 and v4 integrations.

The public bridge API is unchanged:

```ts
import { DatadogBridge } from '@mastra/datadog';

const bridge = new DatadogBridge({
  mlApp: 'my-app',
  agentless: false,
});
```
