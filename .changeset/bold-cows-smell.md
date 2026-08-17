---
'@mastra/core': minor
---

Persist experimental signal subscriptions across restarts and coordinate polling ownership across replicas. Signal subscription APIs are now asynchronous.

Before:

```ts
const subscription = provider.subscribeThread(target, resourceId);
```

After:

```ts
const subscription = await provider.subscribeThread(target, resourceId);
```
