import type { ReactNode } from 'react';
import { ChatLayoutSide } from './chat-layout-side';
import { SideDrawer } from './side-drawer';

export function ChatLayoutDetails({
  mobile,
  open,
  onOpenChange,
  children,
}: {
  mobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  if (mobile) {
    return (
      <SideDrawer side="right" title="Details" open={open} onOpenChange={onOpenChange}>
        {children}
      </SideDrawer>
    );
  }
  return (
    <ChatLayoutSide side="end" open={open}>
      {children}
    </ChatLayoutSide>
  );
}
