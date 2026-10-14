---
'@mastra/factory': minor
---

Added a Factory model scope setting so sessions can use organization models and credentials or their owner’s personal models and credentials.

Organization admins choose the scope through the project API:

```http
PATCH /web/factory/projects/:id
Content-Type: application/json

{"modelScope":"user"}
```

Use `"factory"` for organization models and credentials. Credential scope changes apply on the next model invocation without replacing a thread’s selected model. Session ownership and project policy are resolved from durable records, and unavailable or ambiguous policy stops execution instead of falling back to another account.
