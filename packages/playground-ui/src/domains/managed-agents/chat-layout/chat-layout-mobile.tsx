import type { ReactNode } from 'react';
import type { ChatLayoutProps } from './chat-layout-types';
import { Drawer, DrawerBackdrop, DrawerPopup, DrawerPortal, DrawerTitle, DrawerViewport } from '@/ds/components/Drawer';

function SideDrawer({
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

export function ChatLayoutMobile({
  threads,
  threadsOpen = false,
  onThreadsOpenChange = () => undefined,
  details,
  detailsOpen,
  onDetailsOpenChange,
  children,
}: ChatLayoutProps) {
  return (
    <div data-slot="chat-layout" className="relative flex h-full min-h-0 flex-col">
      {children}
      {threads ? (
        <SideDrawer side="left" title="Threads" open={threadsOpen} onOpenChange={onThreadsOpenChange}>
          {threads}
        </SideDrawer>
      ) : null}
      {details ? (
        <SideDrawer side="right" title="Details" open={detailsOpen} onOpenChange={onDetailsOpenChange}>
          {details}
        </SideDrawer>
      ) : null}
    </div>
  );
}
