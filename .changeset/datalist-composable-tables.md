---
'@mastra/playground-ui': minor
---

Added opt-in options to `DataList` for building custom tables. Existing lists render exactly as before.

- `size="lg"` gives rows a 44px minimum height (also on `DataListSkeleton`).
- `toolbar` renders controls inside the list frame, above the header. Use `DataList.Toolbar` with `DataList.ToolbarStart` and `DataList.ToolbarEnd` to hold `ListSearch`, `Combobox`, or `PropertyFilter`.
- `align` (`start` or `end`) and `tone` (`ink` or `muted`) on every cell, and `align` on `DataList.TopCell`.
- `DataList.StackedCell` shows a title with a secondary line under it.

```tsx
<DataList
  columns="auto auto minmax(12rem,1fr) auto"
  size="lg"
  toolbar={
    <DataList.Toolbar>
      <DataList.ToolbarStart>
        <ListSearch label="Search credits" placeholder="Search credits" onSearch={setSearch} />
      </DataList.ToolbarStart>
      <DataList.ToolbarEnd>
        <Combobox
          aria-label="Filter by status"
          multiple
          options={statuses}
          value={selected}
          onValueChange={setSelected}
        />
      </DataList.ToolbarEnd>
    </DataList.Toolbar>
  }
>
  <DataList.Top>
    <DataList.TopCell>Type</DataList.TopCell>
    <DataList.TopCell>Amount</DataList.TopCell>
    <DataList.TopCell>Description</DataList.TopCell>
    <DataList.TopCell align="end">Balance</DataList.TopCell>
  </DataList.Top>
  <DataList.RowStatic>
    <DataList.TextCell tone="ink">Credit grant</DataList.TextCell>
    <DataList.NumberCell align="start" tone="ink">
      $2.00
    </DataList.NumberCell>
    <DataList.StackedCell description="Onboarding reward">Deployed starter agent</DataList.StackedCell>
    <DataList.NumberCell>$6.95</DataList.NumberCell>
  </DataList.RowStatic>
</DataList>
```
