---
'@mastra/playground-ui': minor
---

Cleaned up the tables in metrics cards: one table for figures, and a share bar that is only a chart.

**Replaced `MetricsShareList` with `ShareBar`**

`ShareBar` shows each row's share of a total: the bar, then the column headers, then a compact legend row per segment. Sorting, the no-bar mode and header placement options are gone; use `MetricsTable` for a sortable table of figures.

```tsx
// Before
<MetricsShareList rows={rows} columns={columns} valueLabel="Spend" headerPlacement="below-strip" />

// After
<ShareBar rows={rows} columns={columns} valueLabel="Spend" />
```

**`MetricsTable` is ready for full tables**

- `pageSize` adds pagination, and `isLoading` shows skeleton rows under the real header instead of the empty message.
- A column's `description` explains it in a tooltip on the header text, marked by a dotted underline.
- A third click on a sorted column turns sorting off, back to `defaultSort` or the given order.
- `isRowActive` highlights a row, for example the one a page is filtered to.
- Headers now line up with their columns, figure columns share spare width with the card, and every table uses the same 34.5px rows.

**New pieces for table rows**

- `SegmentedName` shows a name in parts, such as `openai › gpt-5`. The traces timeline uses it for span names.
- `SeriesMark` takes an optional `color`: without one it is a neutral tile, for tables without a chart. `ProviderMark` puts a provider logo in it.

The metrics Breakdown card now uses `MetricsTable`, with an icon before each agent, workflow, tool or model name, and each model's provider.
