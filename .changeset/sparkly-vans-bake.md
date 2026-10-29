---
'@mastra/playground-ui': minor
---

Hover highlights no longer glide between items. DropdownMenu, ContextMenu, Select, Combobox, Command, CommandPalette, FilterBar, PropertyFilter, Pagination and DataList rows each paint their own hover and keyboard highlight, and switch instantly. The current page in Pagination keeps its raised pill without sliding.

**Removed**

- `@mastra/playground-ui/hooks/use-fluid-hover` (`useFluidHover`, `useRegisterFluidHoverItem`) and `@mastra/playground-ui/components/fluid-hover-highlight` (`FluidHoverHighlight`). Give each row its own hover style instead.
- The `highlightClassName` prop of `CommandList`. Style the row radius on `CommandItem` instead.

```tsx
// Before
<CommandList highlightClassName="rounded-lg">{items}</CommandList>
// After
<CommandList>{items}</CommandList>
```
