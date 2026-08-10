---
'@mastra/core': minor
---

Added AgentController live-session deletion with a process-local listener.

```ts
controller.onSessionDeleted(session => {
  console.log(session.identity.getResourceId())
})
await controller.deleteSession({ resourceId: 'project-42' })
```
