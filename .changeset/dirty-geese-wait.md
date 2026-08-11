---
'@mastra/core': minor
---

Added AgentController live-session deletion with a process-local listener. Deletion is runtime-only: persisted threads and messages remain in storage and can be resumed by a future session.

```ts
controller.onSessionDeleted(session => {
  console.log(session.identity.getResourceId())
})
await controller.deleteSession({ resourceId: 'project-42' })
```
