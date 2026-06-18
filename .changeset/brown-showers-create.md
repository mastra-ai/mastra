---
'@mastra/playground-ui': minor
---

Added drawer overlay modes for floating panels:

- `auto`: keeps default drawer behavior and renders floating drawers without an overlay.
- `transparent`: blocks background interaction without drawing a visible backdrop.
- `visible`: renders the standard dimmed backdrop and blocks background interaction.

Each overlay-enabled floating drawer keeps native outside-click and drag dismissal.

```tsx
<Drawer side="right" variant="floating" overlay="auto">
  <DrawerContent>...</DrawerContent>
</Drawer>

<Drawer side="right" variant="floating" overlay="transparent">
  <DrawerContent>...</DrawerContent>
</Drawer>

<Drawer side="right" variant="floating" overlay="visible">
  <DrawerContent>...</DrawerContent>
</Drawer>
```
