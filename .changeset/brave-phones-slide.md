---
'@mastra/playground-ui': minor
---

`Dialog` now opens as a bottom drawer on phone-sized screens (below 640px), so every existing dialog adapts to mobile without changes at the call site. People can swipe it down to close, the same as pressing Cancel. Pending dialogs still refuse to close.

**Removed props.** The same dialog can now render either way, so `DialogContent` no longer accepts `render` or a function `style`, and `Dialog` no longer accepts `handle`. Pass a plain style object, and control the dialog with `open` instead of a handle:

```tsx
// Before
const handle = DialogPrimitive.createHandle();
<Dialog handle={handle}>
  <DialogContent style={state => ({ maxWidth: state.open ? 480 : 400 })}>…</DialogContent>
</Dialog>;

// After
const [open, setOpen] = useState(false);
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent style={{ maxWidth: 480 }}>…</DialogContent>
</Dialog>;
```
