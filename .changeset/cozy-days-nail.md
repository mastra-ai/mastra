---
'@mastra/playground-ui': minor
---

Improved metrics charts on long date ranges. The latency and token usage cards now use hourly points for ranges up to 48 hours and daily points beyond that, including custom ranges. Daily points are labelled with the date (for example `Sep 24`), and chart X-axis labels now thin out to fit the card width.

**Drilldown:** `LatencyCardView`'s `onPointClick` now receives the bucket size as a third argument, so the drilldown window matches the clicked point.

```tsx
// Before
onPointClick={(tab, point) => navigate(getBucketTracesHref(tab, point, '1h'))}
// After
onPointClick={(tab, point, interval) => navigate(getBucketTracesHref(tab, point, interval))}
```

**Removed:** the `LATENCY_INTERVAL` export. Read `interval` from the `useLatencyMetrics()` result or use the new `chooseMetricsInterval()` helper instead.
