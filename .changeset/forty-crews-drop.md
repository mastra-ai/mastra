---
'@mastra/core': patch
'@mastra/memory': minor
---

Added opt-in Observational Memory thread titles.

When enabled, the Observer suggests a short thread title and updates it as the conversation topic changes. Harness consumers can detect these updates via the new `om_thread_title_updated` event.

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
