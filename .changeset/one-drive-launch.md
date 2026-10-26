---
'@mastra/connect': minor
---

Added a OneDrive toolset with 20 tools for drive discovery, folder and file management, uploads, downloads, copying, moving, sharing, and permissions.

```ts
import { Agent } from '@mastra/core/agent';
import { tools } from '@mastra/connect';

const driveAgent = new Agent({
  id: 'drive-agent',
  name: 'Drive agent',
  instructions: 'Use the connected OneDrive tools to manage files and folders.',
  model: 'openai/gpt-5-mini',
  tools: tools({ providers: ['one-drive'] }),
});
```
