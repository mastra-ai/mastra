---
'@mastra/playground-ui': minor
---

Improved the chart card header: the title now sits over the total, the legend beside the total on the right, and the expand link is a button in the top-right corner. Legends use smaller markers and stay hidden while a chart loads or has no data.

Changed empty charts to look the same everywhere: the dates stay, under dashed rulers and "No data in this range". Totals now show 0 instead of "—" when the range is empty. `MetricsGrid` and `DashboardGrid` now switch to two columns on wider containers, so cards no longer get cramped side by side.

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
