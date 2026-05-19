---
'@mastra/playground-ui': patch
---

Migrated `Popover` to Base UI internally. `Popover`, `PopoverTrigger asChild`, `PopoverContent` (with `align`, `side`, `sideOffset`, `alignOffset`) and `HoverPopover` keep their existing API and styling. Internal-only: `onOpenAutoFocus`/`onCloseAutoFocus` (Radix) are no longer accepted — use Base UI's `initialFocus`/`finalFocus` props instead if you need to control focus on open or close.
