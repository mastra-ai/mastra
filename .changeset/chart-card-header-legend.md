---
'@mastra/playground-ui': minor
---

Chart cards now show the title over the total, with the legend beside the total on the right and the expand link as a button in the top-right corner. Legends use smaller markers, and stay hidden while a chart loads or has no data.

Every empty chart now looks the same: its dates stay, under dashed rulers and "No data in this range". Totals show 0 instead of "—" when the range is empty. `MetricsGrid` and `DashboardGrid` switch to two columns on wider containers, so cards no longer get cramped side by side.

**Breaking:** `ChartArea` no longer takes `emptyMessage`, and the `timeseries` and `scores` dashboard widgets no longer accept an `emptyMessage` option. Remove it from your cards and widget definitions. Table widgets keep their `emptyMessage`.

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
