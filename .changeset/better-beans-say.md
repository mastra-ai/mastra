---
'@mastra/client-js': minor
---

Added a concrete return type to `getOMRecord()` on the agent controller session client. It previously returned `Promise<unknown>`, so reading observational memory meant casting the result by hand. The method now returns the typed `AgentControllerOMRecord`, exposing the committed observation log and any buffered observations or reflection that have not yet been folded into it.

**Before**

```ts
const record = (await session.getOMRecord()) as { activeObservations: string };
```

**After**

```ts
const record = await session.getOMRecord();
record?.activeObservations;
record?.bufferedReflection;
```
