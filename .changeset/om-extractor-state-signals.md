---
'@mastra/memory': minor
---

Added `observationalMemory.stateSignals`. When it's on, Observational Memory gives the agent the current task, suggested response and custom extractor values as a state signal in the conversation, instead of as sections at the end of the system prompt. The Observer updates these values every time it buffers, so the sections changed the system prompt between observations and invalidated any prompt cache placed after them. With `stateSignals` the system prompt stays the same until the observation log itself changes. Off by default.

```ts
const memory = new Memory({
  options: {
    observationalMemory: {
      model: 'google/gemini-2.5-flash',
      stateSignals: true,
    },
  },
});
```
