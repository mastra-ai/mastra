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

`PageLayout` takes an optional `headerBorder` prop (default `true`). Set it to `false` to drop the header's bottom border while keeping its height, so content below stays in the same place.

```tsx
<PageLayout headerBorder={false} breadcrumbs={<ViewSwitch />} actionRow={<FilterBar />}>
  {children}
</PageLayout>
```

`FilterBar` chips that are already there when the bar mounts no longer play their entrance animation; only chips added afterwards animate in. The traces loading skeleton now matches the toolbar's pill-shaped controls and spacing, so the page no longer jumps when it finishes loading.
