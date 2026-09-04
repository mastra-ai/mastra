---
'@mastra/memory': major
---

**Breaking:** Observational-memory token counting methods now return promises.

Before:

```ts
const tokens = counter.countString(text);
```

After:

```ts
const tokens = await counter.countString(text);
```

This lets CommonJS applications load token utilities only when needed.
