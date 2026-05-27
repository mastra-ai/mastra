---
'@mastra/playground-ui': patch
---

Pointer drags inside the `SideDialog` body now select text reliably instead of fighting with the close-swipe gesture. The popup chrome (header, edges) still closes the drawer on drag.

The previous `DrawerContent` composition helper (Portal + Backdrop + Viewport + Popup) is renamed to **`DrawerShell`** so that **`DrawerContent`** can re-export Base UI's text-selectable `Drawer.Content` primitive. Naming now matches Base UI 1:1.

**Migration**

```tsx
// Before
import { DrawerContent } from '@mastra/playground-ui';
<DrawerContent>…</DrawerContent>;

// After
import { DrawerShell } from '@mastra/playground-ui';
<DrawerShell>…</DrawerShell>;
```
