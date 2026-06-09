---
'@mastra/playground-ui': minor
---

**Added an `xs` size** to Button, Input, Select, and InputGroup for compact, dense layouts.

```tsx
<Button size="xs">Compact</Button>
<Input size="xs" />
```

**Unified the keyboard-focus look across controls.** Buttons now show the same subtle border highlight on focus as inputs and selects, instead of a green ring, so a row of buttons, inputs, and selects feels consistent.

**Made Select and Combobox triggers match buttons.** They are now pill-shaped and reuse the Button styling, so a select reads like a button with a dropdown arrow. Their field-safe visual variants are `default` (filled, used by default), `outline`, and `ghost` — the same looks as buttons, minus the high-emphasis `primary`. Since `default` is the default, you only pass a `variant` to switch to `outline` or `ghost`. Legacy `SelectTrigger variant="primary"` and `Combobox variant="link"` are still accepted for source compatibility, but render as the closest field-safe look. MultiCombobox's `variant` now works (it previously had no effect).

**Deprecated `asChild`** on the DropdownMenu, Dialog, AlertDialog, and Popover triggers (and DialogClose). Pass your element to the `render` prop instead. `asChild` still works for now.

```tsx
// Before
<DropdownMenu.Trigger asChild>
  <Button>Open</Button>
</DropdownMenu.Trigger>

// After
<DropdownMenu.Trigger render={<Button>Open</Button>} />
```
