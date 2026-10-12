---
'@mastra/playground-ui': minor
---

`AlertDialog` now opens as a bottom drawer on phone-sized screens (below 640px), the same as `Dialog`. Tapping outside still does not close it; swiping it down works like Cancel. Existing alert dialogs need no change.

**Removed props.** `AlertDialog.Content` no longer accepts `render`, a function `style` or `role` (it is always `alertdialog`), and `AlertDialog` no longer accepts `handle`. Pass a plain style object, and control the alert with `open` instead of a handle:

```tsx
// Before
const handle = AlertDialogPrimitive.createHandle();
<AlertDialog handle={handle}>
  <AlertDialog.Content style={state => ({ maxWidth: state.open ? 480 : 400 })}>…</AlertDialog.Content>
</AlertDialog>;

// After
const [open, setOpen] = useState(false);
<AlertDialog open={open} onOpenChange={setOpen}>
  <AlertDialog.Content style={{ maxWidth: 480 }}>…</AlertDialog.Content>
</AlertDialog>;
```

`DialogContent` with `showCloseButton={false}` no longer reserves space for the missing close button next to the header.
