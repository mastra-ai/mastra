---
'@mastra/playground-ui': major
---

Replaced the Behavior trace-intelligence stage with Issues so recurring themes focus on actionable failure patterns.

**Migration**

Before:

```ts
const signalNames: TraceSignalName[] = ['goal', 'behavior', 'outcome'];
```

After:

```ts
const signalNames: TraceSignalName[] = ['goal', 'issues', 'outcome'];
```
