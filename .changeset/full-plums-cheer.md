---
'@mastra/server': patch
---

Let controller event streams include buffered agent chunks with `includeThreadStream=true`. Opening a running thread replays its prompt and ongoing tool calls through the existing agent subscription.

```http
GET /agent-controller/:controllerId/sessions/:resourceId/stream?includeThreadStream=true
```
