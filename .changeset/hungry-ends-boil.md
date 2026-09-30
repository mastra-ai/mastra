---
'@mastra/server': minor
---

Added `POST /memory/threads/:threadId/archive` and `POST /memory/threads/:threadId/unarchive` routes, and an `archived` query parameter on `GET /memory/threads`. Thread responses now include `archivedAt`.

Archive a thread without deleting its messages, then restore it:

```http
POST /api/memory/threads/thread-123/archive?agentId=my-agent
```

```http
POST /api/memory/threads/thread-123/unarchive?agentId=my-agent
```

List only active threads with `GET /api/memory/threads?agentId=my-agent&archived=false`. Omitting `archived` continues to return both active and archived threads.
