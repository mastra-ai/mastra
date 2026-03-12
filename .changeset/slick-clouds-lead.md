---
'@mastra/memory': minor
'@mastra/core': patch
---

Added observer context optimization for Observational Memory. The `previousObservationTokens` field under `observation.observer` reduces Observer input token costs for long-running conversations:

- **previousObservationTokens** (default: `2000`): Truncates the 'Previous Observations' section to a token budget, keeping the most recent observations and automatically replacing already-reflected lines with the buffered reflection summary. Set to `0` to omit previous observations entirely, or `false` to disable truncation and keep the full observation history.

```typescript
const memory = new Memory({
  options: {
    observationalMemory: {
      model: 'google/gemini-2.5-flash',
      observation: {
        observer: {
          previousObservationTokens: 10_000,
        },
      },
    },
  },
});
```
