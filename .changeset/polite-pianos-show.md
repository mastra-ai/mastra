---
'@mastra/factory': minor
---

Added two reads that serve a Factory board without sending every card. `GET /web/factory/projects/:id/work-items/columns` returns, for each column of a board, how many cards it holds and the first of them in the order asked, after the search and filters given. `GET /web/factory/projects/:id/work-items/filter-options` returns the labels and people the board can be filtered by.

```ts
const res = await fetch(
  `/web/factory/projects/${projectId}/work-items/columns?board=work&label=bug&limit=10&cards=true`,
);
const { columns, matchingTotal, boardTotal, workItems } = await res.json();
// columns: [{ stage: "intake", total: 42, cards: [{ id, changedAt }, …] }, …]
```
