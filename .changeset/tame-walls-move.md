---
'@mastra/server': minor
---

Added stored-agent version label management routes, selector validation, storage capability reporting, and existing read/publish permission mapping.

```http
PUT /stored/agents/agent-id/labels/candidate

{"versionId":"version-2","expectedRevisionToken":null}
```
