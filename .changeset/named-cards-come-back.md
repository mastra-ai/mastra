---
'@mastra/factory': minor
---

Added a `workItemId` filter to the work-item list route for reading cards by id without listing the whole board.

`GET /web/factory/projects/:id/work-items?workItemId=<id>` lists the cards with the given ids and no other. `workItemId` can be repeated, up to 100 times. An id no card has is left out, so asking for a deleted card answers 200 with an empty list. It cannot be combined with `source`, `started`, `sessionId` or `scope`.

```bash
curl "$FACTORY_URL/web/factory/projects/$PROJECT_ID/work-items?workItemId=$CARD_ID"
```
