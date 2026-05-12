---
'@mastra/playground-ui': minor
---

Added column-customization primitives for list views, an indicator dot on `ButtonWithTooltip`, and a real `StatusCell` label set.

**New components and utilities**

- `ColumnsConfigurator` — picker UI for toggling built-in columns, adding custom columns sourced from JSON keys, and resetting to defaults.
- `useColumnPreferences(storageKey, defaultNames)` — persists visible column names in localStorage.
- `useCustomColumns(storageKey)` — persists custom column definitions in localStorage.
- `buildVisibleColumnDefs<T>(args)` — resolves the ordered column-defs array from picker state + user-defined customs.

**`ButtonWithTooltip`** gets a new optional `indicator` prop. When true it renders a small dot in the top-right of the button — a generic affordance for "this control has non-default state".

```tsx
<ButtonWithTooltip tooltipContent="Filter" indicator={filtersActive}>
  <FilterIcon />
</ButtonWithTooltip>
```

**`TracesListView` / `LogsListView`** now require a `columnDefs` prop instead of rendering a hardcoded column set. Existing callers must build defs (typically via `buildVisibleColumnDefs`) and pass them in.

```tsx
const columnDefs = buildVisibleColumnDefs<Trace>({
  visibleNames,
  defaultDefs: TRACE_COLUMN_DEFS,
  allBuiltInDefs: ALL_BUILT_IN_COLUMN_DEFS,
  customColumns,
  widths: TRACES_COLUMN_WIDTHS,
  customSources: ['metadata', 'attributes'],
  renderCustomCell: (trace, source, key) => (
    <TracesDataList.NameCell name={formatCellValue(resolveCustomColumnValue(trace, source, key))} />
  ),
});

<TracesListView traces={traces} columnDefs={columnDefs} ... />
```

**`TracesDataList.StatusCell`** now maps the real values returned by the storage layer (`success`, `running`, `error`) to readable labels — previously the lookup table held a different enum so most rows rendered blank.

**`Select`** gets a new `SelectSeparator` export for divider lines between item groups.
