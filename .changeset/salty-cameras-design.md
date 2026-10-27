---
'@mastra/playground-ui': minor
---

Data layer for Metrics cards built on trace and span aggregates, shared by Studio and pages that span several projects.

- `useMetricsLayout()` says which Metrics page to render: `unified` when the server answers both `aggregateTraces()` and `aggregateSpans()`, otherwise `legacy`, the page as it was. Studio can be upgraded without its storage, so the page falls back instead of showing empty cards.
- `MetricsProvider` takes an optional `scope`. Pass `projectLabel` on a page that spans several projects; cards then add a Project dimension, and drilldowns receive the row's `projectId`.

```tsx
<MetricsProvider {...props} scope={{ projectLabel: id => projectNames[id] ?? id }}>
  <MetricsPage />
</MetricsProvider>
```

- Every card on the page now shares one time window, so cards asking the same question send one request.
- `AggregateLimiterProvider`, exported from `@mastra/playground-ui/domains/metrics/components`, caps trace and span aggregates together at 3 in flight, in page order. `MetricsProvider` already renders one; render it higher up to share the cap across several providers. A request that has started always finishes, so remounting a card (for example under StrictMode) no longer sends it twice.
