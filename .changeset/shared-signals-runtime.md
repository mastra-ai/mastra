---
'@mastra/core': patch
---

Agent signals can now coordinate active thread runs across agents that share a PubSub instance, so thread subscribers and signal senders can observe the same run instead of being limited to one runtime instance.

```ts
import { Agent } from '@mastra/core/agent';
import { EventEmitterPubSub } from '@mastra/core/events';

const pubsub = new EventEmitterPubSub();
const agent = new Agent({
  id: 'agent',
  name: 'Agent',
  instructions: 'Help the user',
  model,
  pubsub,
});
```
