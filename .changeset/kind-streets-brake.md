---
'@mastra/memory': minor
'@mastra/core': patch
'mastracode': patch
---

Added opt-in Observational Memory thread title updates.

- Added `observation.threadTitle` so the Observer can suggest short thread titles.
- Thread title suggestions now flow through synchronous, buffered, and batched observation paths.
- Added a `data-om-thread-update` marker so UIs can react when the title changes.
- Mastra Code now renders thread title update markers and shows non-generic thread titles in the status bar and `/threads` picker.

**Example**
```ts
const memory = new Memory({
  options: {
    observationalMemory: {
      model: 'google/gemini-2.5-flash',
      observation: {
        threadTitle: true,
      },
    },
  },
});
```
