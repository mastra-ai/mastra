---
'@mastra/server': minor
---

Added `POST /api/background-tasks/:backgroundTaskId/resume` to answer a suspended background task over HTTP. Send `resumeData`, and optionally the `suspendedAt` you read from the task, so the server answers `409` instead of delivering a stale answer when the task has resumed or suspended again. Background task responses now include `suspendedAt`. The route needs the new `background-tasks:execute` permission.

```bash
curl -X POST http://localhost:4111/api/background-tasks/$TASK_ID/resume \
  -H 'Content-Type: application/json' \
  -d '{"resumeData":{"approved":true},"suspendedAt":"2026-10-30T10:00:00.000Z"}'
```
