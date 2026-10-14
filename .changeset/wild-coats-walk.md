---
'@mastra/server': minor
'mastra': patch
---

Added `POST /agents/:agentId/queue-signal`, which queues a typed signal to run after the active thread run completes, or starts a run right away when the thread is idle. The body takes the same `signal` shape as `POST /agents/:agentId/signals`.

```bash
curl -X POST http://localhost:4111/api/agents/support-agent/queue-signal \
  -H 'Content-Type: application/json' \
  -d '{
    "resourceId": "user-123",
    "threadId": "thread-123",
    "signal": {
      "type": "reactive",
      "tagName": "skill",
      "attributes": { "name": "triage" },
      "contents": "Triage the new issue."
    }
  }'
```
