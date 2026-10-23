---
'@mastra/playground-ui': minor
---

Added a `size` prop to `Drawer` and `DrawerContent` for wider left and right drawers. `md` keeps the current widths, `lg` is 42rem and `xl` is 56rem, and floating drawers size their viewport to match. Fixed a sideways trackpad bounce inside drawers in Chrome.

```tsx
<Drawer side="right" variant="floating" size="lg">
```
