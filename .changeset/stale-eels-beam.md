---
'@mastra/core': minor
---

Added a `persist` option to processor aborts. By default, a tripwire saves nothing from the turn, so the user message and any tool calls that already finished are lost from memory. Set `persist: true` to save them before the run stops.

```ts
async processInputStep({ abort }) {
  // Before: the user message and earlier steps were dropped from the thread
  abort("Context limit reached");

  // After: the user message and finished steps are saved, then the run stops
  abort("Context limit reached", { persist: true });
}
```

`persist` applies to aborts from `processInput`, `processInputStep`, and `processLLMRequest`, which run before the model writes the blocked step. It is ignored for output-side aborts, so blocked content is never saved.
