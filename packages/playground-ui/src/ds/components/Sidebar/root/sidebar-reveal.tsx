import type { MouseEvent, ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { RevealDrawer } from './reveal-drawer';
import { useSidebar } from './sidebar-context';
import { useRevealGesture } from './use-reveal-gesture';
import { cn } from '@/lib/utils';

import './sidebar-reveal.css';

type SidebarRevealProps = {
  children: ReactNode;
  className?: string;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
};

export function SidebarReveal({ children, className, onClick }: SidebarRevealProps) {
  const { scopeRef, openMobile, mobileDrawerPresent, mobileTriggerRef, setOpenMobile, setMobileDrawerPresent } =
    useSidebar();

  useRevealGesture({
    scopeRef,
    name: 'sidebar',
    side: 'left',
    open: openMobile,
    onGrab: () => flushSync(() => setMobileDrawerPresent(true)),
    onRelease: setOpenMobile,
    onSettled: () => {
      if (!openMobile) setMobileDrawerPresent(false);
    },
  });

  return (
    <RevealDrawer
      name="sidebar"
      open={openMobile}
      present={mobileDrawerPresent}
      label="Navigation"
      closeLabel="Close navigation menu"
      onClose={() => setOpenMobile(false)}
      triggerRef={mobileTriggerRef}
      panelClassName={cn('left-0 w-(--sidebar-reveal-width)', className)}
      onPanelClick={onClick}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-2">{children}</div>
    </RevealDrawer>
  );
}
