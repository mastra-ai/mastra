---
'@mastra/playground-ui': patch
---

`PopoverContent` no longer forwards the underlying library's auto-focus event handlers (`onOpenAutoFocus`, `onCloseAutoFocus`). To control focus when the popover opens or closes, use `initialFocus` and `finalFocus`.

```tsx
// Before
<PopoverContent onOpenAutoFocus={(e) => e.preventDefault()} />

// After
<PopoverContent initialFocus={false} />
```
