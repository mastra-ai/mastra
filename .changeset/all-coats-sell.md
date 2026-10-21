---
'@mastra/playground-ui': minor
---

Saved views can now live anywhere, not only in the browser. `useSavedViews` takes a `backend` (`list`, `create`, `update`, `remove`, all async and run through React Query), and `localStorageSavedViewsBackend(key)` keeps the browser-storage behavior. A view now holds one generic `state`, checked by your own schema, so views with grouped (AND/OR) filters are no longer dropped. Views saved by the previous version in the browser still load.

The page now owns what it shows: pass it as `current`, and put a view on the page in `onApply`. Changing the page while a view is active offers **Save to this view** and **Reset changes**, and switching tabs with unsaved changes asks first (**Cancel**, **Discard changes** or **Save to this view**). Use `SavedViewUnsavedDialog` to ask the same before leaving the page. **Create new view…** saves what the page shows, deleting a view asks for confirmation first, and hovering a tab previews that view's filters and settings (`SavedViewSummary`, `SavedViewSummaryFilters`, `SavedViewSummaryRow`).

**Before**

```tsx
const views = useSavedViews({ storageKey: 'my-board', settingsSchema, activeViewId, onActiveViewChange });
<SavedViewTabs views={views} fields={fields} operators={operators} defaultLabel="All" newViewSettings={settings} />;
```

**After**

```tsx
const views = useSavedViews({
  backend: localStorageSavedViewsBackend('my-board'),
  schema: boardStateSchema,
  activeViewId,
  current: { filters, sort, layout },
  onApply: view => showView(view),
  onActiveViewChange: setActiveViewId,
});
<SavedViewTabs views={views} defaultLabel="All" renderSummary={view => <MySummary view={view} />} />;
```

Also added, for hosts of the traces explorer:

- `useTraceSavedViews` turns the explorer's filters, sort and columns into saved views for any backend. Filters the server can't run stay in the view, and saving keeps them. `useMastraSavedViewsBackend(page)` stores them through the Mastra server.
- The traces explorer shows filters the server can't run, such as AND/OR groups without the trace query API, as muted chips with the reason instead of hiding them. They're left out of the query, and editing other filters keeps them. Servers without the trace query API now also receive the filters their list endpoint supports, such as Run ID, which were previously dropped.
- `TracesExplorer` takes optional `columns` and `onColumnsChange` so the host controls the columns and their order (see `useTraceColumnsState`).
- `DataList` takes `columnOrder` and `onColumnOrderChange` for a controlled column order.
- `FilterBar.Chip` and `FilterBar.AdvancedChip` take `unsupported` (the reason) to show a filter the backend can't run: muted, removable, not editable. `FilterBar.Chips` takes `renderGroup`, and `advancedFilters={false}` stops offering new groups while still showing the ones in the value.
