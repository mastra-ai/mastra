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
  parameters: z.object({ city: z.string() }),
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
  parameters: z.object({ amount: z.number() }),
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
  inputSchema: z.object({ path: z.string() }),
  requireApproval: true,
  execute: async ({ path }) => {
    return { deleted: true };
  },
});
```

**What changed:**
- AI SDK's `needsApproval` (boolean or function) now maps to Mastra's `requireApproval`
- Function-based approval is evaluated dynamically at tool execution time
- Fixed `isVercelTool()` to recognize AI SDK v6 tools using `inputSchema` instead of `parameters`
