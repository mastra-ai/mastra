---
'@mastra/playground-ui': patch
---

Re-exported `useSpanQueryAvailable` from `@mastra/playground-ui/domains/capabilities`, and added a spans filter bar (`@mastra/playground-ui/domains/spans`) that offers only the fields the span query accepts.

`SpanDataPanelView` takes an optional `onShowTrace` callback. When it is set, the panel header shows a "Go to trace" button that calls it with the span's `traceId` and `spanId`, so your app decides where the trace opens.

```tsx
<SpanDataPanelView
  traceId={traceId}
  spanId={spanId}
  span={span}
  onShowTrace={({ traceId, spanId }) => navigate(`/traces?traceId=${traceId}&spanId=${spanId}`)}
/>
```
