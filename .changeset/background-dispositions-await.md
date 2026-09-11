---
'@mastra/core': minor
---

Added per-call background execution dispositions, awaited background calls, caller-scoped completion signals, and bounded delegated background tool execution.

Background-eligible tools continue to run deferred by default. Use `defaultDisposition: 'foreground'` when eligibility should only give the model the option to background individual calls:

```ts
const tool = createTool({
  id: 'research',
  background: {
    enabled: true,
    defaultDisposition: 'foreground',
  },
  // ...
});
```

Eligible calls can now override their execution mode with `_background.disposition`:

```json
{
  "topic": "distributed systems",
  "_background": { "disposition": "awaited" }
}
```

Add the background-work signal processor when tools need caller-scoped completion signals:

```ts
import { Agent } from '@mastra/core/agent';
import { createBackgroundWorkSignalProcessor } from '@mastra/core/processors';

const agent = new Agent({
  // ...
  inputProcessors: [createBackgroundWorkSignalProcessor()],
});

const stream = await agent.stream('Research distributed systems');

for await (const part of stream.fullStream) {
  if (
    part.type === 'data-signal' &&
    (part.data.tagName === 'work-completed' || part.data.tagName === 'work-failed')
  ) {
    handleBackgroundSignal(part.data);
  }
}

function handleBackgroundSignal(signal: { tagName?: string }) {
  if (signal.tagName === 'work-completed') {
    // Handle successful background work.
  } else if (signal.tagName === 'work-failed') {
    // Handle failed background work.
  }
}
```

`deferred` returns a task placeholder while the run continues, `awaited` uses durable background execution while holding the current branch for the authoritative result, and `foreground` executes inline. The legacy `_background.enabled` field remains supported.
