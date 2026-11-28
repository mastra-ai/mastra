import type { ReactNode } from 'react';
import { ChatLayoutSide } from './chat-layout-side';
import { SideDrawer } from './side-drawer';

export function ChatLayoutThreads({
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
      <SideDrawer side="left" title="Threads" open={open} onOpenChange={onOpenChange}>
        {children}
      </SideDrawer>
    );
  }
  return (
    <ChatLayoutSide side="start" open={open}>
      <div className="flex w-65 flex-col overflow-hidden rounded-card bg-card shadow-[inset_0_0_0_1px_var(--surface-rim)]">
        {children}
      </div>
    </ChatLayoutSide>
  );
}
