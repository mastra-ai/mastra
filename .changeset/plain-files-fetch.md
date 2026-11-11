---
'@mastra/factory': minor
---

Added a `scope=sessions` filter to the work-item list route. `GET /web/factory/projects/:id/work-items?scope=sessions` returns only the cards holding a session and the cards related to them (a card's parent and children, and a pull request with the card whose session branch it was pushed from). The response has the same shape as the full list. `scope` cannot be combined with `sessionId`.

A sidebar that lists every session no longer has to download the whole board to name them.

```bash
curl "$FACTORY_URL/web/factory/projects/$PROJECT_ID/work-items?scope=sessions"
```
