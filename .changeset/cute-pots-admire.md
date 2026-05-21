---
'@mastra/core': minor
---

Added Harness v1 at `@mastra/core/harness/v1`, giving developers a session-oriented runtime for long-running agent conversations with persisted session state, queue admission, thread/message access, built-in human-in-the-loop tools, attachments, goals, workspace lifecycle, and recovery primitives.

Example usage:

```ts
import { Agent } from '@mastra/core/agent';
import { Harness } from '@mastra/core/harness/v1';

const agent = new Agent({
  name: 'assistant',
  instructions: 'Help with release planning.',
  model: 'openai/gpt-4o-mini',
});

const harness = new Harness({
  agents: { default: agent },
  modes: [{ id: 'default', agentId: 'default' }],
  defaultModeId: 'default',
});

const session = await harness.session({ resourceId: 'user-1', threadId: { fresh: true } });
await session.message({ content: 'Help me plan the release' });
```
