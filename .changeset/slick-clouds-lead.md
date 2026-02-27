---
'@mastra/memory': minor
'@mastra/core': patch
---

Added opt-in observer context optimization for Observational Memory. Three new fields on the observation config reduce Observer input token costs for long-running conversations:

- **contextTokenBudget**: Truncates the 'Previous Observations' section to a token budget, keeping the most recent observations
- **includeBufferedReflection**: Includes pending buffered reflection content in the Observer's context
- **minContextTokenSavings**: Gating threshold — only applies optimization when token savings exceed this value. Set to `0` to always optimize. Fully customizable, no enforced minimum.

All three are disabled by default. Existing behavior is unchanged unless you opt in.

```typescript
const memory = new Memory({
  options: {
    observationalMemory: {
      model: 'google/gemini-2.5-flash',
      observation: {
        contextTokenBudget: 10_000,
        includeBufferedReflection: true,
        minContextTokenSavings: 2_000,
      },
    },
  },
});
```
