---
'@mastra/factory': minor
---

Added automatic thread naming to MastraFactory. Set the new threadTitle option and each session's first message fires a cheap side-model request that gives otherwise-untitled threads a short noun-phrase title. Threads that already carry a title (work items, review sessions, manual renames) are never touched, and omitting the option keeps today's fallback names.

By default the title model is picked the same way the OM observer model is: the cheap pack of the first provider with credentials. A specific model can be pinned instead:

```ts
new MastraFactory({
  storage,
  threadTitle: { model: 'google/gemini-2.5-flash', thinkingLevel: 'low' },
});
```
