---
'@mastra/playground-ui': minor
---

Dashboard chart cards can now link to a fuller view, and line charts can mark points in time.

- `DashboardRenderer` takes an `expand` option. When `expand.href(widget)` returns a URL, the card shows its title as a link with an expand icon, in place of its views menu.
- `MetricsLineChart` takes `markers`: dashed vertical lines at buckets, for example where a billing period starts. Each marker's `x` must match a bucket's `xKey` value.
- `DateTimeRangePicker` (and `FilterBar.TimeRange`) take `namedRanges`: fixed ranges such as the current billing period, listed above the presets and named on the trigger while applied.

```tsx
<DashboardRenderer
  definition={definition}
  scope="project"
  expand={{ href: widget => `/query?widget=${widget.id}`, LinkComponent: RouterLink }}
/>

<MetricsLineChart data={data} series={series} markers={[{ x: "2026-11-01", label: "Period starts" }]} />
```

Metrics charts now use thin lines, and the large card header no longer shifts when its value finishes loading.
