---
'@mastra/core': patch
---

Improved cancellation of durable and evented agent tool and model calls after execution ownership is lost. Cooperative tools receive an abort signal so superseded work can stop sooner without canceling the recovering run. Recovery may run a tool again, so tools must be safe to repeat. Cancellation cannot undo work already completed.

Pass the tool's abort signal to operations that support cancellation:

```ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const fetchText = createTool({
  id: 'fetch-text',
  description: 'Fetch text from a URL.',
  inputSchema: z.object({ url: z.string().url() }),
  outputSchema: z.string(),
  execute: async ({ url }, context) => {
    // Without the signal, the request keeps running after ownership is lost.
    const response = await fetch(url, { signal: context?.abortSignal });
    return response.text();
  },
});
```
