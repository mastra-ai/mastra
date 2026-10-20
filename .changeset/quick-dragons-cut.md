---
'@mastra/react': minor
---

Added `useSpanAggregateAvailable()`, which reports whether the server supports `aggregateSpans()`.

```tsx
const { isLoading, enabled } = useSpanAggregateAvailable();
if (!isLoading && enabled) {
  // render span aggregate charts
}
```
