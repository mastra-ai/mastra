import { useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { RevealDrawer } from './reveal-drawer';
import { useMaybeSidebar } from './sidebar-context';
import { useRevealGesture } from './use-reveal-gesture';
import { cn } from '@/lib/utils';

import './aside-reveal.css';

export type AsideRevealProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names the drawer while it is open. */
  label: string;
  /** Takes focus back when the drawer closes. */
  triggerRef?: RefObject<HTMLElement | null>;
  /** Mounted only while the drawer is out: open, dragged, or settling closed. */
  children: ReactNode;
  className?: string;
};

/**
 * The right-edge counterpart of the sidebar's mobile drawer: a leftward swipe anywhere in the shell
 * (or `open`) slides the page left to uncover the panel, and a rightward swipe, Escape, or a tap on the
 * page puts it back. Shares the sidebar's gesture and scope, so only one of the two drawers is out at a time:
 * an `open` set while navigation is out waits for navigation to close.
 * Render it inside `SidebarProvider` and `AppShell`; it portals beside the shell, not inside the page that moves.
 */
export function AsideReveal({ open, onOpenChange, label, triggerRef, children, className }: AsideRevealProps) {
  const sidebar = useMaybeSidebar();
  if (!sidebar) throw new Error('AsideReveal must be used within a SidebarProvider.');
  const { scopeRef, scope, drawerOwnerRef, mobileDrawerPresent } = sidebar;
  // Navigation keeps the edge while it is on screen, closing slide included; the panel follows once it is gone.
  const out = open && !mobileDrawerPresent;
  // Held out past `out` while a drag or the closing slide is on screen. Set on grab, and once an open settles,
  // so a close from any source (gesture, Escape, scrim, or the parent) slides out before unmounting.
  const [held, setHeld] = useState(false);
  const present = out || held;

  const close = () => {
    setHeld(true);
    onOpenChange(false);
  };

  useRevealGesture({
    scopeRef,
    ownerRef: drawerOwnerRef,
    name: 'aside',
    side: 'right',
    open: out,
    onGrab: () => flushSync(() => setHeld(true)),
    onRelease: onOpenChange,
    onSettled: () => setHeld(out),
  });

  if (!scope) return null;

  return createPortal(
    <RevealDrawer
      name="aside"
      open={out}
      present={present}
      label={label}
      closeLabel={`Close ${label.toLowerCase()}`}
      onClose={close}
      triggerRef={triggerRef}
      panelClassName={cn('right-0 flex w-(--aside-reveal-width) flex-col', className)}
    >
      {present ? children : null}
    </RevealDrawer>,
    scope,
  );
}
