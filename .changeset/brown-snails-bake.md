---
'@mastra/core': patch
---

Expose the existing buffered agent thread stream through `Session.subscribeToThread()` so clients can attach during a running tool without driving the controller's execution loop again.

Expose tool payload transform helpers through `@mastra/core/tools/payload-transform` so browser clients can reuse display transforms without importing server dependencies.

```typescript
const subscription = await session.subscribeToThread();
for await (const chunk of subscription?.stream ?? []) {
  console.log(chunk);
}
```
