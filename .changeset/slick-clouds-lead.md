---
'@mastra/memory': minor
'@mastra/core': patch
---

Added opt-in observer context optimization for Observational Memory. Two new fields under `observation.observer` reduce Observer input token costs for long-running conversations:

- **previousObservationTokens**: Truncates the 'Previous Observations' section to a token budget, keeping the most recent observations. Supports `0` for full truncation and `false` to disable truncation explicitly.
- **useBufferedReflection**: Includes pending buffered reflection content in the Observer's context while reflection is still buffered.

Both are disabled by default. Existing behavior is unchanged unless you opt in.

```typescript
const memory = new Memory({
  options: {
    observationalMemory: {
      model: 'google/gemini-2.5-flash',
      observation: {
        observer: {
          previousObservationTokens: 10_000,
          useBufferedReflection: true,
        },
      },
    },
  },
});
```
