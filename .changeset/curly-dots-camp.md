---
'@mastra/cursor': minor
---

Added `@mastra/cursor`, a package for running Cursor SDK agents through Mastra.

Create a Cursor SDK agent, pass it to Mastra, and call `generate()` or `stream()` with Mastra-compatible outputs. Runs keep Cursor SDK usage and observability data available to Mastra.

```ts
import { Agent as CursorAgent } from '@cursor/sdk';
import { CursorSDKAgent } from '@mastra/cursor';

export const cursorAgent = new CursorSDKAgent({
  id: 'cursor-sdk-agent',
  description: 'Use Cursor Agent SDK through Mastra.',
  agent: CursorAgent.create({
    apiKey: process.env.CURSOR_API_KEY,
    model: { id: 'gpt-5.5' },
    local: {
      cwd: process.cwd(),
    },
  }),
});
```
