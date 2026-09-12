---
'@mastra/playground-ui': minor
---

Adds `TabbedContainer`, a contained tab composition for mixed panel types. `Panel` accepts arbitrary content. `DataList` renders a table and can place search and filter controls in the tab rail. Both types support the existing tab states and close behavior. Visited panels stay mounted, preserving their scroll position and local state.

```tsx
<TabbedContainer defaultTab="overview">
  <TabbedContainer.Panel value="overview" label="Overview">
    <Overview />
  </TabbedContainer.Panel>
  <TabbedContainer.DataList
    value="runs"
    label="Runs"
    columns="auto minmax(0,1fr) auto"
    search={{ label: 'Search runs', placeholder: 'Search runs', value: query, onSearch: setQuery }}
    filter={{
      'aria-label': 'Filter by status',
      multiple: true,
      options: statusOptions,
      value: statuses,
      onValueChange: setStatuses,
    }}
  >
    {runRows}
  </TabbedContainer.DataList>
</TabbedContainer>
```

Contained tabs move extra items into a `+N` menu. Closable overflow items can now be closed from that menu without selecting them.

```tsx
<Tabs defaultTab="runs">
  <TabList>
    <Tab value="runs" onClose={() => closeTab('runs')}>Runs</Tab>
  </TabList>
  <TabContent value="runs" flush keepMounted>
    <RunsTable />
  </TabContent>
</Tabs>
```

Adds `DataList.SortableTopCell`, a controlled column header that switches between ascending and descending sort directions.

```tsx
<DataList.SortableTopCell sortDirection={sortDirection} onSortChange={setSortDirection}>
  Created at
</DataList.SortableTopCell>
```

Multi-select comboboxes can show a `clearLabel` footer action, and combobox triggers accept an explicit `aria-label`.

```tsx
<Combobox
  aria-label="Filter by status"
  multiple
  options={statusOptions}
  value={statuses}
  onValueChange={setStatuses}
  clearLabel="Clear filters"
/>
```

Also adds `flush` and `keepMounted` to `TabContent`. `flush` lets a panel component own the body surface. `keepMounted` keeps a visited panel in the DOM after a tab switch.
