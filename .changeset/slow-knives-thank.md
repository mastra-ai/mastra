---
'@mastra/client-js': major
---

Replaced the built-in `behavior` trace signal with `issues`.

**Migration**

Before:

```ts
const signal: TraceSignalName = 'behavior';
```

After:

```ts
const signal: TraceSignalName = 'issues';
```
