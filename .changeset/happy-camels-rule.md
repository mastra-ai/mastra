---
'@mastra/core': minor
---

Added portable top-level string metadata predicates to advanced trace queries. Metadata keys and values are validated before storage execution and work inside recursive Boolean predicates.

```ts
where: { op: "eq", left: { path: "metadata.messageId" }, right: { literal: "message-123" } }
```
