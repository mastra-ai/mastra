---
'@mastra/playground-ui': minor
---

Added `MetricsTable`, `SeriesMark` and `Sparkline` for the numbers behind a chart, and a title link on `ChartCard`.

- `MetricsTable` lists one row per series or group, with lines between rows that fade at the ends. Columns set their own cell, width, alignment and sort value. Sort can be controlled (for example kept in the URL), and row hover and click let the table act as the chart's legend.
- `SeriesMark` ties a row to its chart series: a small color square, or an icon such as a provider logo drawn in the series color on a tinted square.
- `Sparkline` draws a tiny trend line for a row.
- `ChartCard` takes `href` (and `LinkComponent`) to make its title a link to a fuller view of the chart, marked by an expand icon.
- `DropdownMenu.RadioOptions` takes `closeOnSelect` to close the menu when an option is picked.

```tsx
import { MetricsTable } from '@mastra/playground-ui/components/MetricsTable';
import { SeriesMark } from '@mastra/playground-ui/components/SeriesMark';

<MetricsTable
  rows={models}
  getRowKey={m => m.id}
  columns={[
    { id: 'name', header: 'Model', width: 'minmax(0,1fr)', cell: m => <><SeriesMark color={m.color} />{m.name}</> },
    { id: 'spend', header: 'Spend', align: 'end', cell: m => m.spend, sortValue: m => m.rawSpend },
  ]}
/>;
```
