---
'@mastra/react': minor
---

`useMemoryThreadMessages` accepts an optional `agentId` and reads the thread's messages from that agent's memory. Without it, the hook reads from the default storage as before.

```ts
const { data } = useMemoryThreadMessages({ threadId, agentId });
```
