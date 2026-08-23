---
'@mastra/factory': minor
---

Added automatic thread naming to MastraFactory. Set the new threadTitle option and each session's first message fires a cheap side-model request that gives otherwise-untitled threads a short noun-phrase title. Threads that already carry a title (work items, review sessions, manual renames) are never touched, and omitting the option keeps today's fallback names.

By default the title comes from the first provider with credentials — Anthropic gets claude-haiku-4-5, OpenAI gets gpt-5.6-luna at low thinking. A specific model can be pinned instead:

```ts
new MastraFactory({
  storage,
  threadTitle: { model: 'google/gemini-2.5-flash', thinkingLevel: 'low' },
});
```
