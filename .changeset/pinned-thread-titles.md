---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed manually renamed thread titles being replaced by Observational Memory. Explicitly regenerating a title enables automatic title updates again, as do programmatic title writes that opt out of pinning:

```ts
await session.thread.rename({ title: 'Initial title', pin: false });
```

Fixes #22421
