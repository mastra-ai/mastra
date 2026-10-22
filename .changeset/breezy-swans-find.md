---
'@mastra/playground-ui': minor
---

The `SavedViews` components now work with views stored on a server, not only in the browser. Build the `views` object `SavedViewTabs` and `SavedViewEditor` take from your own data, and set `pending`, `isLoading` and `loadError` while it loads or saves. `save` now returns a promise.

- `SavedViewTabs` takes `confirmDelete` to ask before deleting a view, and `confirmUnsavedSwitch` to ask before switching away from unsaved changes (**Cancel**, **Discard changes**, **Save changes**). Use `SavedViewUnsavedDialog` to ask the same before leaving the page.
- `SavedViewEditor` takes `storageLabel` to say where a new view is saved, or `null` to hide it.
- `storedSavedViewSchema`, `savedViewNameSchema` and `MAX_SAVED_VIEW_NAME_CHARS` are exported to read views from your own store.

```tsx
<SavedViewEditor views={views} storageLabel={null}>
  <SavedViewTabs
    views={views}
    fields={fields}
    operators={operators}
    defaultLabel="All"
    newViewSettings={settings}
    confirmDelete
    confirmUnsavedSwitch
  />
</SavedViewEditor>
```

Also added:

- `FilterBar.Chip` and `FilterBar.AdvancedChip` take `unsupported` (the reason) to show a filter the backend can't run: muted, removable, not editable. `FilterBar.Chips` takes `renderGroup`, and `maxDepth={0}` stops offering new groups while still showing the ones in the value.
- The traces explorer shows filters the server can't run, such as AND/OR groups without the trace query API, as muted chips with the reason instead of hiding them. Editing other filters keeps them, and its list follows `columns.order` when the host controls the columns.
- `DataList` takes `columnOrder` and `onColumnOrderChange` for a controlled column order, and reports moves through `onColumnOrderChange` when it stores the order itself.
- `dateRangePresetLabel(preset)` returns the label `DateTimeRangePicker` shows for a preset.
