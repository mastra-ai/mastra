---
'@mastra/core': patch
---

Added Alibaba provider support for Qwen models. You can now use Qwen, DashScope, and other Alibaba models with automatic provider detection.

**Example usage:**

```typescript
import { Mastra } from '@mastra/core';

const mastra = new Mastra();

// Use any Alibaba variant - automatically detected
const agent = mastra.getAgent('myAgent');
const result = await agent.generate({
  model: '__GATEWAY_ALIBABA_MODEL__',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

Works with all Alibaba variants (alibaba, alibaba-cn, alibaba-coding-plan, etc.) and future variants like alibaba-coding-plan-cn-v2.
