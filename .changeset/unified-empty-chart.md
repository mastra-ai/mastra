---
'@mastra/playground-ui': minor
---

Changed empty charts to look the same everywhere: the chart keeps its dates but drops its lines and y-axis, under dashed rulers and "No data in this range". Legends stay hidden while a chart loads or has nothing to show, and totals show 0 instead of "—" when the range is empty.

`ChartArea`'s `emptyMessage` is now only for a reason other than an empty range, such as a preview that can't run yet; leave it out for an empty range. The `emptyMessage` option of `timeseries` and `scores` dashboard widgets is deprecated: saved definitions still parse, but every empty chart shows "No data in this range". Table widgets keep their `emptyMessage`.

```tsx
// Before
<ChartArea isEmpty={runs === 0} emptyMessage="No agent runs in this range.">
  <MetricsLineChart {...chart} />
</ChartArea>

// After
<ChartArea isEmpty={runs === 0}>
  <MetricsLineChart {...chart} />
</ChartArea>
```
