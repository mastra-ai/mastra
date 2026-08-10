---
'@mastra/client-js': minor
---

Added `getA2AV1()` for opt-in A2A Protocol v1.0 requests, including task listing and v1 streaming responses. Existing `getA2A()` integrations remain on v0.3.

```typescript
const a2a = client.getA2AV1('weather-agent');
const tasks = await a2a.listTasks(ListTasksRequest.fromJSON({ pageSize: 20 }));
```
