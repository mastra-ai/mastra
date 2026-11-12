---
'@mastra/factory': minor
---

Added filters to the work-item list route for finding cards without listing the whole board.

`GET /web/factory/projects/:id/work-items?started=false` lists the cards holding no session, most recently updated first. `q` keeps the cards whose title, key, number or source id contains every word in it, `limit` sets how many are sent (20 unless given, 50 at most), and `total` in the response counts every match. `source`, which can be repeated, lists the cards filed from the given source ids or URLs. `started` and `source` cannot be combined with each other, with `sessionId` or with `scope`.

```bash
curl "$FACTORY_URL/web/factory/projects/$PROJECT_ID/work-items?started=false&q=login+flow&limit=10"
curl "$FACTORY_URL/web/factory/projects/$PROJECT_ID/work-items?source=https://github.com/acme/app/issues/12"
```
