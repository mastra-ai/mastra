---
'@mastra/memory': patch
'@mastra/core': patch
---

Added application-specific instructions to Observational Memory recall tools.

```typescript
const memory = new Memory({
  options: {
    observationalMemory: {
      retrieval: {
        additionalInstructions: 'Check the current thread before browsing other threads.',
      },
    },
  },
})
```
