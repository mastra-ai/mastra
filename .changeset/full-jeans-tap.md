---
'@mastra/core': minor
---

Added support for server-defined `toModelOutput` on client-side tools. When a tool without an `execute` function runs in the browser and sends its result back, the server tool definition's `toModelOutput` now transforms that result before the model sees it — matching AI SDK behavior. This lets a client tool return a compact payload (like an uploaded file id or base64 image) and have the server map it into real model content:

```ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// No execute: the browser runs this tool and returns { fileId, dataUrl }
const takeScreenshot = createTool({
  id: 'takeScreenshot',
  description: 'Captures the screen',
  inputSchema: z.object({}),
  outputSchema: z.object({ fileId: z.string(), dataUrl: z.string() }),
  toModelOutput: output => ({
    type: 'content',
    value: [{ type: 'image-url', url: output.dataUrl }],
  }),
});
```

Previously the model only ever saw the raw JSON tool result and transforming it required a custom input processor.
