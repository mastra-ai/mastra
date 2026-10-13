---
'@mastra/factory': minor
---

Added a Factory model scope setting so sessions can use organization models and credentials or their owner’s personal models and credentials.

Choose the scope through the project API:

```http
PATCH /web/factory/projects/:id
Content-Type: application/json

{"modelScope":"user"}
```

Use `"factory"` for organization models and credentials.
