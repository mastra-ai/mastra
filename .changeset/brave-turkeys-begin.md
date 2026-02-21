---
'@mastra/core': minor
'@mastra/editor': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Added Processor Providers — a new system for configuring and hydrating processors on stored agents. Define custom processor types with config schemas, available phases, and a factory method, then compose them into serializable processor graphs that support sequential, parallel, and conditional execution.

**Example — custom processor provider:**

```ts
import { MastraEditor } from '@mastra/editor';

// Built-in processors (token-limiter, unicode-normalizer, etc.) are registered automatically.
// Only register custom providers for your own processors:
const editor = new MastraEditor({
  processorProviders: {
    'my-custom-filter': myCustomFilterProvider,
  },
});
```

**Example — stored agent with a processor graph:**

```ts
const agentConfig = {
  inputProcessors: {
    steps: [
      { type: 'step', step: { id: 'norm', providerId: 'unicode-normalizer', config: {}, enabledPhases: ['processInput'] } },
      { type: 'step', step: { id: 'limit', providerId: 'token-limiter', config: { limit: 4000 }, enabledPhases: ['processInput', 'processOutputStream'] } },
    ],
  },
};
```
