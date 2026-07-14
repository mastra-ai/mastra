---
'@mastra/client-js': patch
---

Type structured Agent Controller notification message content so Web clients can render notification provenance from live and persisted transcript messages.

```ts
if (part.type === 'notification') {
  renderNotification(part.message, part.source)
}
```
