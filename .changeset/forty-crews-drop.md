---
'@mastra/memory': minor
---

Added opt-in Observational Memory thread titles.

When enabled, the Observer can suggest a short thread title and update it as the conversation topic changes.

**Example**
```ts
const memory = new Memory({
  options: {
    observationalMemory: {
      observation: {
        threadTitle: true,
      },
    },
  },
});
```
