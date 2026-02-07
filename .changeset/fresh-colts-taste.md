---
'@mastra/memory': minor
'@mastra/playground-ui': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added async buffering for observational memory. Observations can now be pre-computed in the background before the main threshold is reached, reducing latency when the context window fills up.

**New configuration options:**

- `observation.bufferTokens` — Token interval for triggering background observation buffering (e.g., `6000` buffers every 6k tokens)
- `observation.bufferActivation` — Ratio of the message token threshold to activate when buffered observations are applied (0-1 float, e.g., `0.6` activates 60% of the threshold worth of message tokens)
- `observation.blockAfter` — Token count (or 1.x multiplier of the threshold) at which synchronous observation blocks the response. Defaults to 1.2x when async buffering is enabled
- `reflection.bufferActivation` — Same as observation but for reflections. Background reflection runs when observation tokens cross the activation point
- `reflection.blockAfter` — Same as observation but for reflections

**Example:**

```ts
const memory = new Memory({
  storage: new LibSQLStore({ url: 'file:memory.db' }),
  options: {
    observationalMemory: {
      observation: {
        messageTokens: 30_000,
        bufferTokens: 6_000,
        bufferActivation: 0.6,
        blockAfter: 1.5,
      },
      reflection: {
        observationTokens: 5_000,
        bufferActivation: 0.5,
        blockAfter: 1.2,
      },
    },
  },
});
```

**New streaming event:** `data-om-status` replaces `data-om-progress` with a structured status object containing active window usage, buffered observation/reflection state, and projected activation impact.

**Buffering markers:** New `data-om-buffering-start`, `data-om-buffering-end`, and `data-om-buffering-failed` streaming events for UI feedback during background operations.
