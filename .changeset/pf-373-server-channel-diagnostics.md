---
'@mastra/server': minor
---

Added `GET /harness/:name/sessions/:sessionId/channel-diagnostics`.

Use the endpoint to retrieve read-only channel diagnostics for a Harness session. The response includes per-ledger summaries with timestamps, channel IDs, status, and redacted payload information, with `limit` capped at 50 rows per ledger. Sessions outside the caller's access return not found.

```bash
curl -X GET "/harness/my-harness/sessions/sess_123/channel-diagnostics?limit=25" \
  -H "Authorization: Bearer YOUR_TOKEN"
```
