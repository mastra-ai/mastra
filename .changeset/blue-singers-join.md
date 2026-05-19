---
'@mastra/playground-ui': patch
---

Migrated `DropdownMenu` to Base UI internally. No breaking changes — `DropdownMenu.Trigger asChild`, `open`, `defaultOpen`, `modal`, `Content sideOffset/align/side/container`, `Item disabled`, `Sub`/`SubTrigger`/`SubContent`, `CheckboxItem`, `RadioGroup`/`RadioItem`, `Label`, `Separator`, `Shortcut` all keep their existing API and styling. `Item` gains a `variant: 'default' | 'destructive'` option.
