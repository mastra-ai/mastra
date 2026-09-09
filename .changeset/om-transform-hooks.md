---
'@mastra/memory': minor
---

Added transform hooks to Observational Memory so applications can intercept and reshape data before it reaches the Observer/Reflector models or storage. `observationalMemory.hooks` now accepts `beforeObservation` (filter or redact messages before observation; returning no messages skips the model call), `afterObservation` (rewrite observations before they are persisted), `beforeReflection` (rewrite the observations sent to the Reflector), and `afterReflection` (rewrite the reflection before it is persisted). Transform hooks are always awaited, `void` passes data through unchanged, and a thrown error fails the cycle so un-transformed data is never stored. Per-call `observe({ hooks })` now accepts lifecycle hooks only. Fixes #15626.

Previously, lifecycle hooks could report cycle activity but could not replace the messages sent to the Observer. Configure a transform hook to filter those messages:

```typescript
import { Memory } from '@mastra/memory';

const memory = new Memory({
  options: {
    observationalMemory: {
      model: 'google/gemini-2.5-flash',
      hooks: {
        beforeObservation: ({ messages }) => ({
          messages: messages.filter(message => message.role === 'user'),
        }),
      },
    },
  },
});
```
