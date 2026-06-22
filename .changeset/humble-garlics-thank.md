---
"@mastra/playground-ui": minor
---

Added sticky row headers to DataList.

Use `sticky="start"` on the leading `DataList.TopCell` and `DataList.RowHeaderCell` for the matching row cells:

```tsx
<DataList columns="auto auto auto" variant="lined">
  <DataList.Top>
    <DataList.TopCell sticky="start">Model</DataList.TopCell>
    <DataList.TopCell>Input</DataList.TopCell>
    <DataList.TopCell>Output</DataList.TopCell>
  </DataList.Top>
  <DataList.RowStatic>
    <DataList.RowHeaderCell>__GATEWAY_OPENAI_MODEL_BASE__</DataList.RowHeaderCell>
    <DataList.Cell>1,200</DataList.Cell>
    <DataList.Cell>800</DataList.Cell>
  </DataList.RowStatic>
</DataList>
```

Metrics tables now render directly through DataList so sticky row headers share the same header colors and hover treatment as the rest of the list system. Metrics tables also follow the default DataList variant, and sticky row headers use the same neutral header treatment as column headers.

DataList now exposes `stickyHeaderBackground` to keep the top header and sticky row-header fill in sync, and forwards `mask` to the underlying ScrollArea so sticky-start tables can disable the left edge fade.

Added `DataList.NumberCell` for right-aligned numeric columns. It bakes in the tabular-figure, compact metric-table styling, with a `highlight` prop for the emphasized value:

```tsx
<DataList.NumberCell>1,200</DataList.NumberCell>
<DataList.NumberCell highlight>$0.42</DataList.NumberCell>
```

The metrics-specific `MetricsDataTable` wrapper was removed. Use DataList for DS-owned metrics table layouts.
