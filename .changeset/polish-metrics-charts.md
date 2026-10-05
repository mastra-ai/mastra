---
'@mastra/playground-ui': major
---

Polished the metrics charts and KPI cards, and added options for leaner charts.

**Charts**
- Stacked bars use gradient segments with a soft halo, and hovering a column dims the others. Pass `variant="capped"` to `MetricsStackedBarChart` for single-value columns (a translucent body under a solid cap).
- Lines are smooth with a soft glow, and the hover cursor glides between points.
- Charts line up with the card's content: no side padding, and the first and last x-axis labels stay inside the plot.
- New `showYAxis` option on `MetricsStackedBarChart` and `MetricsLineChart`. Set it to `false` to drop the value labels; exact values stay in the tooltip.
- The stacked bar tooltip ends with the column's total when two or more series are stacked (`showTotal` to override). The Total label starts at the tooltip's left edge.
- New `valueFormatter` on `MetricsLineChart` formats y-axis ticks and tooltip values (e.g. `ms`, `%`).
- Chart colors are softer and more balanced in dark mode, with a new `--chart-cyan` token.

**KPI cards**
- `MetricsKpiCard.Label` takes an `icon`, and new `MetricsKpiCard.Footer` and `MetricsKpiCard.Prev` show a detail line and the prior period's value.
- The change badge sits next to the value with the strong badge fill, and the value row never wraps. `MetricsKpiCard.Change` takes `comparison` as optional (defaults to "vs prior period") and shows it on hover with the prior value, e.g. "vs previous 7d (693)".
- `MetricsCardGroup` sizes its columns by its own width: four cards share one row from 56rem, five go 3 + 2 and then one row from 72rem.

**Cards**
- Action buttons sit to the left of the summary and are centered in the top bar.
- Card content no longer scrolls by a pixel, and tables drop the border under their last row.

**Breaking:** `MetricsCardGroup` no longer takes a `variant` prop, and the `MetricsCardGroupVariant` type is removed. Cards always sit directly on the page with the page gap.

```tsx
// Before
<MetricsCardGroup variant="inset">{cards}</MetricsCardGroup>

// After
<MetricsCardGroup>{cards}</MetricsCardGroup>
```
