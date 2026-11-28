import type { ReactNode } from 'react';
import { Drawer, DrawerBackdrop, DrawerPopup, DrawerPortal, DrawerTitle, DrawerViewport } from '@/ds/components/Drawer';

export function SideDrawer({
  side,
  title,
  open,
  onOpenChange,
  children,
}: {
  side: 'left' | 'right';
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Drawer side={side} open={open} onOpenChange={onOpenChange}>
      <DrawerPortal>
        <DrawerBackdrop />
        <DrawerViewport>
          <DrawerPopup className="w-[calc(100vw-2.5rem)] max-w-md">
            <DrawerTitle className="sr-only">{title}</DrawerTitle>
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </DrawerPopup>
        </DrawerViewport>
      </DrawerPortal>
    </Drawer>
  );
}
