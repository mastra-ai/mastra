---
'@mastra/playground-ui': minor
---

Added an “Add filter” button variant that reveals field, operator, and value segments as you select them. Pending segments stay detached as rounded capsules and join the previous segment only once selected. Search moves into the popover, and each selection opens the next step automatically. Once filters exist, a separate compact ghost “+” appears, and filters are removed individually. Validation keeps the selected labels in place and finishes with one shimmer in the field’s accent color. Native transitions animate removal, while popover options appear with a subtle stagger. All animations respect reduced motion.

The default input is now a compact rounded field beside the filters, without an enclosing bar. Each selection morphs the current input capsule into a tag while the next input appears, preserving focus through quick selections. Suggestions follow the active input. Capsules share the standard input height and fully rounded ends. Completion, removal, and wrapped rows move together, with a selected-value preview and completion shimmer. Search and keyboard selection stay inline. Opt into the button with the same children:

```tsx
<FilterBar variant="button" fields={fields} operators={operators} value={filters} onValueChange={setFilters}>
  <FilterBar.Chips />
  <FilterBar.Input />
</FilterBar>
```
