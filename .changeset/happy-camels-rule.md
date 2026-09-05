---
'@mastra/core': minor
---

Added portable top-level string metadata predicates to advanced trace queries. Invalid metadata keys and values are rejected consistently, and valid predicates work inside recursive Boolean expressions.

```ts
where: { op: "eq", left: { path: "metadata.messageId" }, right: { literal: "message-123" } }
```
