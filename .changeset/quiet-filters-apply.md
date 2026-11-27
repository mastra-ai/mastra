---
'@mastra/playground-ui': minor
---

Added an opt-in `applyMultiSelectOnDismiss` prop to `FilterBar`. When set, "is any of" / "is none of" selections apply when the dropdown is dismissed (clicking outside or tabbing away) instead of through a Done button.

```tsx
<FilterBar fields={fields} operators={operators} value={items} onValueChange={setItems} applyMultiSelectOnDismiss>
  <FilterBar.Chips />
  <FilterBar.Input />
</FilterBar>
```

- An unchanged selection applies nothing.
- Removing every value from an existing filter removes the filter; an empty new filter is not added.
- Escape or Cancel discards the changes.
- Typed text becomes a value only when you press Enter.
- Ctrl/Cmd+Enter still applies right away.
