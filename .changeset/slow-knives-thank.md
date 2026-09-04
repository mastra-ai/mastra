---
'@mastra/client-js': minor
---

Replaced the built-in `behavior` trace signal with `issues` in the beta Trace Intelligence feature.

**Migration**

Before:

```ts
const signal: TraceSignalName = 'behavior';
```

After:

```ts
const signal: TraceSignalName = 'issues';
```
