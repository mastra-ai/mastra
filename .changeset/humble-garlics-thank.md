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

Metrics tables now render directly through DataList so sticky row headers share the same header colors and hover treatment as the rest of the list system. Metrics tables also follow the default DataList variant and tune sticky row-header backgrounds to match metrics cards.

The metrics-specific `MetricsDataTable` wrapper was removed. Use DataList for DS-owned metrics table layouts.
