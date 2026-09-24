---
'mastra': patch
---

Updated API tooling metadata for cancelling selected pending thread signals and clearing pending input when aborting a thread. With `MASTRA_API_URL` set to your server's API base URL, including its `/api` prefix:

```bash
curl -X POST "$MASTRA_API_URL/agents/my-agent/threads/signals/cancel" \
  -H 'Content-Type: application/json' \
  -d '{"threadId":"thread-abc","signalIds":["signal-123"]}'

curl -X POST "$MASTRA_API_URL/agents/my-agent/threads/abort" \
  -H 'Content-Type: application/json' \
  -d '{"threadId":"thread-abc","clearPendingSignals":true}'
```
