---
'@mastra/memory': minor
---

**Async buffering for observational memory is now enabled by default.** Observations are pre-computed in the background as conversations grow — when the context window fills up, buffered observations activate instantly with no blocking LLM call. This keeps agents responsive during long conversations.

**Default settings:**
- `observation.bufferTokens: 0.2` — buffer every 20% of `messageTokens` (~6k tokens with the default 30k threshold)
- `observation.bufferActivation: 0.8` — on activation, retain 20% of the message window
- `reflection.bufferActivation: 0.5` — start background reflection at 50% of the observation threshold

**Disabling async buffering:**

Set `observation.bufferTokens: false` to disable async buffering for both observations and reflections:

```ts
const memory = new Memory({
  options: {
    observationalMemory: {
      model: "google/gemini-2.5-flash",
      observation: {
        bufferTokens: false,
      },
    },
  },
});
```

**Model is now required** when passing an observational memory config object. Use `observationalMemory: true` for the default (google/gemini-2.5-flash), or set a model explicitly:

```ts
// Uses default model (google/gemini-2.5-flash)
observationalMemory: true

// Explicit model
observationalMemory: {
  model: "google/gemini-2.5-flash",
}
```

**`shareTokenBudget` requires `bufferTokens: false`** (temporary limitation). If you use `shareTokenBudget: true`, you must explicitly disable async buffering:

```ts
observationalMemory: {
  model: "google/gemini-2.5-flash",
  shareTokenBudget: true,
  observation: { bufferTokens: false },
}
```

**New streaming event:** `data-om-status` replaces `data-om-progress` with a structured status object containing active window usage, buffered observation/reflection state, and projected activation impact.

**Buffering markers:** New `data-om-buffering-start`, `data-om-buffering-end`, and `data-om-buffering-failed` streaming events for UI feedback during background operations.
