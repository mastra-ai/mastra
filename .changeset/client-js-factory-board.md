---
'@mastra/client-js': minor
---

Added `client.getFactory(projectId, { basePath })` for reading and moving cards on a Factory board: board phases, card lists, filter options, starters, activity, card create/move/update/delete, decisions and the run queue. `basePath` lets hosts that serve Factory's routes elsewhere point the client at them.

```ts
const factory = client.getFactory('fp-1');
const view = await factory.boardPhases(
  { board: 'work', sort: 'recent', q: '', filters: {}, windows: {} },
  { cards: true },
);
const card = view.workItems![0];
await factory.transitionWorkItem(card.id, {
  board: 'work', stage: 'build', expectedRevision: card.revision, requestId: crypto.randomUUID(), cause: 'drag',
});
```
