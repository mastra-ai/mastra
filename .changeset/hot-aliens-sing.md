---
'@mastra/playground-ui': patch
---

Pointer drags inside the `SideDialog` body now select text reliably instead of fighting with the close-swipe gesture. The popup chrome (header, edges) still closes the drawer on drag.

**Drawer composition**

`DrawerContent` is now the shadcn-style opinionated bundle (`DrawerPortal` + `DrawerBackdrop` + `DrawerViewport` + `DrawerPopup`, with a handle bar on top/bottom-anchored drawers and a fade-out when a nested drawer covers the parent). Most drawers can now be written as:

```tsx
<Drawer>
  <DrawerTrigger>…</DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>…</DrawerHeader>
    <DrawerBody>…</DrawerBody>
  </DrawerContent>
</Drawer>
```

The low-level primitives (`DrawerPortal`, `DrawerBackdrop`, `DrawerViewport`, `DrawerPopup`) remain exported for drawers that need a custom portal target, non-modal page behavior, or chrome outside the popup (see the `SwipeToOpen` and `NonModal` Storybook examples).

Base UI's text-selectable region (the `Drawer.Content` part — pointer drags inside it select text instead of closing the drawer) is now exported as `DrawerInteractive`. Migration:

```tsx
// Before
import { DrawerContent } from '@mastra/playground-ui';
<DrawerContent render={<div>...</div>} />;

// After
import { DrawerInteractive } from '@mastra/playground-ui';
<DrawerInteractive render={<div>...</div>} />;
```
