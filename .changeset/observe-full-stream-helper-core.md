---
'@mastra/core': patch
---

`Agent.observe()` and `DurableAgent.observe()` now share a single helper for detaching an observer's `fullStream` subscription, instead of each keeping its own copy. The helper is exported from `@mastra/core/agent/durable` as `detachFullStreamOnEnd`, so durable-agent integrations stop reimplementing the wrapper:

```ts
import { createDurableAgentStream, detachFullStreamOnEnd } from '@mastra/core/agent/durable';

// Wrap the observer's own stream output, right after the stream is created.
const { output, detach } = createDurableAgentStream({ ... });
detachFullStreamOnEnd(output, detach);
```

The subscription is detached when the stream completes, when a read throws, and when the consumer cancels. Existing `Agent.observe()` and `DurableAgent.observe()` behavior is unchanged.
