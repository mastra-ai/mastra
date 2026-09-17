---
'@mastra/playground-ui': minor
---

Added an “Add filter” button variant that reveals field, operator, and value segments as you select them. Pending segments stay detached as rounded capsules and join the previous segment only once selected. Search moves into the popover, and each selection opens the next step automatically. Once filters exist, a separate compact ghost “+” appears, and filters are removed individually. Quick spring transitions animate adding and removing filters, while popover options appear with a subtle stagger. Both respect reduced motion.

The input remains the default. Opt into the button with the same children:

```tsx
<FilterBar variant="button" fields={fields} operators={operators} value={filters} onValueChange={setFilters}>
  <FilterBar.Chips />
  <FilterBar.Input />
</FilterBar>
```
