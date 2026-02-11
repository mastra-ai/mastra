---
'@mastra/memory': minor
"@mastra/opencode": patch
---

@mastra/opencode: Add opencode plugin for Observational Memory integration

Added standalone `observe()` API that accepts external messages directly, so integrations can trigger observation without duplicating messages into Mastra's storage.

**New exports:**

- `ObserveHooks` — lifecycle callbacks (`onObservationStart`, `onObservationEnd`, `onReflectionStart`, `onReflectionEnd`) for hooking into observation/reflection cycles
- `OBSERVATION_CONTEXT_PROMPT` — preamble that introduces the observations block
- `OBSERVATION_CONTEXT_INSTRUCTIONS` — rules for interpreting observations (placed after the `<observations>` block)
- `OBSERVATION_CONTINUATION_HINT` — behavioral guidance that prevents models from awkwardly acknowledging the memory system
- `getOrCreateRecord()` — now public, allows eager record initialization before the first observation cycle

```ts
import { ObservationalMemory } from '@mastra/memory/processors';

const om = new ObservationalMemory({ storage, model: 'google/gemini-2.5-flash' });

// Eagerly initialize a record
await om.getOrCreateRecord(threadId);

// Pass messages directly with lifecycle hooks
await om.observe({
  threadId,
  messages: myMessages,
  hooks: {
    onObservationStart: () => console.log('Observing...'),
    onObservationEnd: () => console.log('Done!'),
    onReflectionStart: () => console.log('Reflecting...'),
    onReflectionEnd: () => console.log('Reflected!'),
  },
});
```

**Breaking:** `observe()` now takes an object param instead of positional args. Update calls from `observe(threadId, resourceId)` to `observe({ threadId, resourceId })`.
