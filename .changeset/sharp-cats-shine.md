---
'@mastra/factory': minor
---

Added `cards=false` to `GET /web/factory/projects/:id/work-items?scope=sessions`. The answer then names each card holding a session by the `version` of its body and sends no card, so a reader that keeps the cards reads only the ones that changed, with `?workItemId=`. `scope=sessions` now sends each card with its `version` too.

```ts
const res = await fetch(`/web/factory/projects/${projectId}/work-items?scope=sessions&cards=false`);
const { cards, runningSessionIds, parkedSessionIds } = await res.json();
// cards: [{ id, version }, …]
```
