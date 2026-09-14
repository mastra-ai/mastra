---
'@mastra/playground-ui': patch
---

`DropdownMenu.Trigger`, `PopoverTrigger` and the `DateTimePicker` default trigger now render a design-system `Button` by default and accept Button's `variant`, `size` and `tooltip` props, so every click-to-open trigger shares the same recipe as `Select` and `Combobox` (including the open-state styling). `render` and `asChild` keep working and take precedence over `variant`/`size`. Bare triggers that relied on being unstyled must now pass `variant="ghost"` or use `render`.
