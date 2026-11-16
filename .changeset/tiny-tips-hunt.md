---
'@mastra/factory': minor
---

Added two reads that serve the sidebar's sessions without sending every session and every card holding one. `GET /web/factory/projects/:id/session-rows` returns one view of a project's sessions as rows, sorted, grouped and filtered on the server, with the first five rows of each group and how many each group holds. A card's sessions come back as one row carrying the card, its pull or merge request and its status. `GET /web/factory/projects/:id/session-activity` returns which sessions are running, waiting on a person or still coming up. Both answer `304` when nothing changed.

A project's session list is now kept in memory and read from the database again only when a session was added, removed or changed. Each request first checks a count and the newest row instead of reading every session.

```ts
const res = await fetch(
  `/web/factory/projects/${projectId}/session-rows?groupBy=board&owner=mine&window=board:work:25`,
);
const { groups, matching } = await res.json();
// groups: [{ key: "board:work", total: 42, rows: [{ session, status, card, pullRequest, … }, …] }, …]
```
