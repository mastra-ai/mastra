---
'@mastra/factory': minor
---

Added two reads that serve a Factory board without sending every card. `GET /web/factory/projects/:id/boards/:boardKey/phases` returns, for each phase of the board, how many cards it holds and the first of them in the order asked, after the search and filters given. `GET /web/factory/projects/:id/work-items/filter-options` returns the labels and people the board can be filtered by.

```ts
const res = await fetch(`/web/factory/projects/${projectId}/boards/work/phases?label=bug&limit=10&cards=true`);
const { phases, matchingTotal, boardTotal, workItems } = await res.json();
// phases: [{ phase: "intake", total: 42, cards: [{ id, changedAt }, …] }, …]
```
