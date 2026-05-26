---
'mastracode': patch
---

**Fixed: custom Harness v1 mode agents now receive the configured Memory and signals PubSub.**

When `createMastraCode` is called with a custom mode whose `agent` is a static `Agent` instance that does not own its own memory or PubSub, mastracode now wires the harness-level Memory and signals PubSub to that agent — matching legacy `Harness` behavior. Previously these services only reached the default `code-agent`, so observation persistence and signal routing were silently dropped for custom mode agents.

Agents that own these services keep their own (the runtime guards on `hasOwnMemory()` / `hasOwnPubSub()`); the same agent reused across multiple modes is only updated once.

```ts
import { createMastraCode } from 'mastracode';
import { Agent } from '@mastra/core/agent';

const reviewAgent = new Agent({
  id: 'review-agent',
  name: 'Review',
  instructions: 'review code',
  model: '__GATEWAY_OPENAI_MODEL_MINI__',
  // no own memory or pubsub — inherits both from the harness now
});

await createMastraCode({
  modes: [
    { id: 'review', name: 'Review', default: true, agent: reviewAgent },
  ],
});

// before: reviewAgent.getMemory() === undefined, observations + signals dropped
// after:  reviewAgent.getMemory() === harnessMemory, signals route via harness pubsub
```
