---
'@mastra/playground-ui': patch
---

Pointer drags inside the `SideDialog` body now select text reliably instead of fighting with the close-swipe gesture. The popup chrome (header, edges) still closes the drawer on drag.

`DrawerContent` now re-exports Base UI's text-selectable `Drawer.Content` primitive, matching Base UI naming 1:1. The previous `DrawerContent` composition helper (Portal + Backdrop + Viewport + Popup) is removed — components should compose the primitives directly, the way `SideDialog` does.

**Migration**

```tsx
// Before
import { DrawerContent } from '@mastra/playground-ui';

<Drawer>
  <DrawerContent>…</DrawerContent>
</Drawer>;

// After
import { DrawerPortal, DrawerBackdrop, DrawerViewport, DrawerPopup } from '@mastra/playground-ui';

<Drawer>
  <DrawerPortal>
    <DrawerBackdrop />
    <DrawerViewport>
      <DrawerPopup>…</DrawerPopup>
    </DrawerViewport>
  </DrawerPortal>
</Drawer>;
```
