---
'@mastra/playground-ui': minor
---

Added a Drawer component — a panel that slides in from any edge of the screen with swipe-to-dismiss gestures.

Built on Base UI, the Drawer supports four anchor sides, snap points, nested stacking, controlled state, non-modal mode, swipe-to-open areas, and detached triggers.

```tsx
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
  Button,
} from '@mastra/playground-ui';

<Drawer side="right">
  <DrawerTrigger asChild>
    <Button>Open</Button>
  </DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Library</DrawerTitle>
      <DrawerDescription>A panel that slides in from the right edge.</DrawerDescription>
    </DrawerHeader>
    <DrawerFooter>
      <DrawerClose asChild>
        <Button variant="outline">Close</Button>
      </DrawerClose>
    </DrawerFooter>
  </DrawerContent>
</Drawer>;
```
