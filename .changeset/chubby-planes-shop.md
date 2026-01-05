---
'@mastra/core': patch
---

Add support for AI SDK's `needsApproval` in tools.

**AI SDK tools with static approval:**

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: 'Get weather information',
  inputSchema: z.object({ city: z.string() }),
  needsApproval: true,
  execute: async ({ city }) => {
    return { weather: 'sunny', temp: 72 };
  },
});
```

**AI SDK tools with dynamic approval:**

```typescript
const paymentTool = tool({
  description: 'Process payment',
  inputSchema: z.object({ amount: z.number() }),
  needsApproval: async ({ amount }) => amount > 1000,
  execute: async ({ amount }) => {
    return { success: true, amount };
  },
});
```

**Mastra tools continue to work with `requireApproval`:**

```typescript
import { createTool } from '@mastra/core';

const deleteTool = createTool({
  id: 'delete-file',
  description: 'Delete a file',
  requireApproval: true,
  inputSchema: z.object({ path: z.string() }),
  execute: async ({ path }) => {
    return { deleted: true };
  },
});
```