---
'@mastra/core': minor
---

Added the Harness v1 API for durable session resolution, lifecycle management, model discovery, thread utilities, and workspace provider registration.

**Usage**

```ts
import { Agent } from '@mastra/core/agent';
import { Harness } from '@mastra/core/harness/v1';
import { InMemoryStore } from '@mastra/core/storage';

const harness = new Harness({
  agents: {
    assistant: new Agent({
      id: 'assistant',
      name: 'Assistant',
      instructions: 'Help the user.',
      model: 'openai/gpt-4o-mini',
    }),
  },
  modes: [{ id: 'default', agentId: 'assistant' }],
  defaultModeId: 'default',
  storage: new InMemoryStore(),
});

const session = await harness.session({
  resourceId: 'user-123',
  threadId: { fresh: true },
});
```
