---
'@mastra/playground-ui': minor
---

Replaced the Behavior stage in the beta Trace Intelligence feature with Issues so recurring themes focus on actionable failure patterns.

**Migration**

Before:

```ts
const signalNames: TraceSignalName[] = ['goal', 'behavior', 'outcome'];
```

After:

```ts
const signalNames: TraceSignalName[] = ['goal', 'issues', 'outcome'];
```
