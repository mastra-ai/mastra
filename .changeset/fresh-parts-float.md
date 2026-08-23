---
'@mastra/factory': minor
---

Added automatic thread naming to MastraFactory. The first message of an otherwise-untitled thread fires a cheap side-model request that gives the thread a short noun-phrase title. Threads that already carry a title (work items, review sessions, manual renames) are never touched, and a disabled setting, an unreachable provider, or a failed request leaves today's fallback naming in place — naming never blocks or fails the answering run.

The setting lives on the Factory settings page (Models › Factory defaults): an on/off toggle plus an optional writer model and thinking level, stored per org. By default it is on and the title model is picked the same way the OM observer model is — the cheap pack of the first provider with credentials. A specific model can be pinned from the UI or the API:

```ts
await fetch('/web/config/title-generation', {
  method: 'PUT',
  body: JSON.stringify({ enabled: true, modelId: 'google/gemini-2.5-flash', thinkingLevel: 'low' }),
});
```
