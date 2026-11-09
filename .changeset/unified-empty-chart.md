---
'@mastra/playground-ui': minor
---

Changed empty charts to look the same everywhere: the chart keeps its dates but drops its lines and y-axis, under dashed rulers and "No data in this range". Legends stay hidden while a chart loads or has nothing to show, and totals show 0 instead of "—" when the range is empty.

**Breaking:** Removed `emptyMessage` from `ChartArea`. Deprecated the `emptyMessage` option of `timeseries` and `scores` dashboard widgets: saved definitions still parse, but the option is ignored. Table widgets keep their `emptyMessage`.

**Before**

```tsx
<ChartArea isEmpty={runs === 0} emptyMessage="No agent runs in this range.">
  <MetricsLineChart {...chart} />
</ChartArea>
```

**After**

```tsx
<ChartArea isEmpty={runs === 0}>
  <MetricsLineChart {...chart} />
</ChartArea>
```
