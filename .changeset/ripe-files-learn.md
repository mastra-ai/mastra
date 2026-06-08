---
'@mastra/playground-ui': minor
---

Added a new `xs` size to Button, Input, Select (SelectTrigger), and InputGroup for compact, dense layouts. Use it like any other size:

```tsx
<Button size="xs">Compact</Button>
<Input size="xs" placeholder="Search" />
<SelectTrigger size="xs">…</SelectTrigger>
<InputGroup size="xs">…</InputGroup>
```

Unified the focus styling across interactive controls: buttons now use the same border-based focus indicator as inputs (the 1px border brightens on keyboard focus) instead of the previous green accent ring, so buttons, inputs, and selects share one consistent focus language.

Made the Select and Combobox triggers pill-shaped (`rounded-full`) to match the Button and Input shape, so triggers sitting next to buttons and inputs share the same rounded silhouette.

The Select trigger now composes the Button recipe instead of hand-rolling its own chrome, so a select reads as "a button plus a trailing chevron" and shares the button's sizes and unified focus. Because a select is a form field rather than a call-to-action, its `variant` prop only offers the field-appropriate looks — `outline` (bordered, the default) and `ghost` (borderless, for dense toolbars). High-emphasis looks like `primary` are intentionally not offered:

```tsx
<SelectTrigger variant="ghost" size="sm">
  <SelectValue placeholder="Pick one" />
</SelectTrigger>
```

Combobox and MultiCombobox triggers now compose that same Button recipe, so every field trigger shares one source of truth for sizing, shape, and focus. Their `variant` is narrowed to the field-appropriate `outline` (default) and `ghost`; the unused `link` look and the redundant `default` alias were removed. MultiCombobox's `variant`, previously inert, now actually styles its trigger. Because `outline` is the default, you no longer pass it explicitly — only reach for `variant="ghost"`.

Deprecated the `asChild` prop on the `DropdownMenu`, `Dialog`, `AlertDialog`, and `Popover` triggers (and `DialogClose`). These wrap Base UI, whose native composition API is the better-typed `render` prop — pass your element there instead. `asChild` still works for now but will be removed:

```tsx
// Before
<DropdownMenu.Trigger asChild>
  <Button>Open</Button>
</DropdownMenu.Trigger>

// After
<DropdownMenu.Trigger render={<Button>Open</Button>} />
```
