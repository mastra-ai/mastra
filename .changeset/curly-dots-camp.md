---
'@mastra/cursor': minor
---

Added `@mastra/cursor`, a package for running Cursor SDK agents through Mastra.

Create a Cursor SDK agent, register it with Mastra, and call `generate()` or `stream()` with Mastra-compatible outputs. Runs keep Cursor SDK usage and observability data available to Mastra.

```ts
import { CursorSDKAgent } from '@mastra/cursor';

export const cursorAgent = new CursorSDKAgent({
  id: 'cursor-sdk-agent',
  description: 'Use Cursor Agent SDK through Mastra.',
  sdkOptions: {
    apiKey: process.env.CURSOR_API_KEY,
    model: { id: process.env.CURSOR_MODEL_ID! },
    local: {
      cwd: process.cwd(),
    },
  },
});
```
