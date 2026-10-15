---
'@mastra/playground-ui': minor
---

Added `Meter`, a thin bar that shows usage against an allowance. Usage past the allowance turns red, sized to how far over it is.

```tsx
import { Meter } from '@mastra/playground-ui/components/Meter';

<Meter value={112} max={100} aria-label="vCPU" aria-valuetext="112 of 100 vCPU-hours" />;
```

Pass `Meter.Source` children to show where the usage came from. Hovering or focusing the bar splits it into one color per source, with a key of each source's amount:

```tsx
<Meter value={148} max={360} aria-label="Memory">
  <Meter.Source label="research-workflows" value={112} />
  <Meter.Source label="Sandboxes" value={36} />
</Meter>
```

`MetricsStackedBarChart` can now print a label above a column. Set `columnLabelKey` to a row field, and rows that have it show the text above their column:

```tsx
<MetricsStackedBarChart data={rows} series={series} columnLabelKey="overage" />
// rows: [..., { time: 'Oct 13', included: 100, over: 12, overage: '$1.20 over' }]
```

An inset `Table` can now draw its header inside the inset with the rows, for a table nested in a card or an expanded row:

```tsx
<Table variant="inset">
  <Table.Header placement="inside">…</Table.Header>
  <Table.Body>…</Table.Body>
</Table>
```
