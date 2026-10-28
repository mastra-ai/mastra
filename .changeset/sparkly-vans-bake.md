---
'@mastra/playground-ui': minor
---

Hover is now instant across the design system, and nothing follows the pointer between items anymore.

**Lists and menus.** DropdownMenu, ContextMenu, Select, Combobox, Command, CommandPalette, FilterBar, PropertyFilter, Pagination and DataList rows each paint their own hover and keyboard highlight, instead of one highlight gliding between rows. The current page in Pagination wears the raised pill in place, without sliding.

**Hover transitions.** Buttons, inputs, sidebar rows, tabs, breadcrumbs, table and tree rows, and hover-revealed row actions switch state immediately instead of fading over 150-200ms. Motion stays for things that move or arrive: popups opening, panels collapsing, the switch thumb, chevrons.

**Removed**

- `@mastra/playground-ui/hooks/use-fluid-hover` (`useFluidHover`, `useRegisterFluidHoverItem`) and `@mastra/playground-ui/components/fluid-hover-highlight` (`FluidHoverHighlight`). Give each row its own hover style instead.
- `controlStateColorTransition` from `@mastra/playground-ui/primitives/transitions`. Drop it from your class lists; hover needs no transition.
- The `highlightClassName` prop of `CommandList`. Style the row radius on `CommandItem` instead.

```tsx
// Before
<Button className={cn(quietTextHover, controlStateColorTransition)} />
// After
<Button className={quietTextHover} />
```
