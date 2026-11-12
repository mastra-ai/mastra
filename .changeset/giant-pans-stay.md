---
'@mastra/factory': minor
---

Added a `sessionId` filter to the work-item list route. `GET /web/factory/projects/:id/work-items?sessionId=<id>` returns only the cards holding that session and the cards related to them (a card's parent and children, and a pull request with the card whose session branch it was pushed from). The response has the same shape as the full list. Repeat `sessionId` to list several sessions' cards in one request.

A page that shows one session no longer has to download the whole board to find its card.

```bash
curl "$FACTORY_URL/web/factory/projects/$PROJECT_ID/work-items?sessionId=$SESSION_ID"
```
