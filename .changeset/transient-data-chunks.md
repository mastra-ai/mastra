---
'@mastra/ai-sdk': patch
---

Custom `data-*` chunks written with `transient: true` now keep that flag when streamed through `@mastra/ai-sdk`, so they reach `onData` without being saved into `message.parts`.
