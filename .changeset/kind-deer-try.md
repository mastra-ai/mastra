---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/memory': patch
'@mastra/core': patch
---

Added support for `transient: true` on agent signals sent via the HTTP API. Transient signals are delivered to the model for the current call only and are never written to thread storage. Sending a transient state signal is now rejected with a validation error, because state signals must persist to track state across turns.

```json
// POST /agents/myAgent/signals
{
  "resourceId": "user-1",
  "threadId": "thread-1",
  "signal": {
    "type": "reactive",
    "contents": "Stay on the current task.",
    "transient": true
  }
}
```
