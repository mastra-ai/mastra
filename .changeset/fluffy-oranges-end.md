---
'@mastra/core': minor
---

Added render-only tools that stream display calls and let agents and sub-agents continue without a client result. Use `renderOnly: true` when the browser only needs to show the call:

```typescript
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

const showCard = createTool({
  id: 'show-card',
  description: 'Display a product card',
  inputSchema: z.object({ productId: z.string() }),
  renderOnly: true,
})
```
