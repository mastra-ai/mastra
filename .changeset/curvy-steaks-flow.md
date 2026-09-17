---
'@mastra/playground-ui': minor
---

Added an “Add filter” button variant that reveals field, operator, and value segments as you select them. Pending segments stay detached as rounded capsules and join the previous segment only once selected. Search moves into the popover, and each selection opens the next step automatically. Once filters exist, a separate compact ghost “+” appears, and filters are removed individually. Validation keeps the selected labels in place and finishes with one shimmer in the field’s accent color. Native transitions animate removal, while popover options appear with a subtle stagger. All animations respect reduced motion.

The default input is now a compact rounded field beside the filters, without an enclosing bar. It shares the capsule transitions, selected-value preview, completion shimmer, and animated removal. Search and keyboard selection stay inline. Opt into the button with the same children:

```tsx
<FilterBar variant="button" fields={fields} operators={operators} value={filters} onValueChange={setFilters}>
  <FilterBar.Chips />
  <FilterBar.Input />
</FilterBar>
```
