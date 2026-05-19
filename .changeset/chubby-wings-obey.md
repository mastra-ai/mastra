---
'@mastra/playground-ui': patch
---

Removed support for the `onOpenAutoFocus` and `onCloseAutoFocus` props on `PopoverContent`. To control focus when the popover opens or closes, use `initialFocus` and `finalFocus` instead.

```tsx
// Before
<PopoverContent onOpenAutoFocus={(e) => e.preventDefault()} />

// After
<PopoverContent initialFocus={false} />
```
