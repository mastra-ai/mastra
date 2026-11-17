import { useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { RevealDrawer } from './reveal-drawer';
import { useMaybeSidebarState } from './sidebar-context';
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
 * page puts it back. Shares the sidebar's gesture and scope, so only one of the two drawers is out at a time.
 * Render it inside `SidebarProvider` and `AppShell`; it portals beside the shell, not inside the page that moves.
 */
export function AsideReveal({ open, onOpenChange, label, triggerRef, children, className }: AsideRevealProps) {
  const sidebar = useMaybeSidebarState();
  if (!sidebar) throw new Error('AsideReveal must be used within a SidebarProvider.');
  const { scopeRef, scope } = sidebar;
  // Held out past `open` while a drag or the closing slide is still on screen.
  const [held, setHeld] = useState(false);
  const present = open || held;

  const close = () => {
    setHeld(true);
    onOpenChange(false);
  };

  useRevealGesture({
    scopeRef,
    name: 'aside',
    side: 'right',
    open,
    onGrab: () => flushSync(() => setHeld(true)),
    onRelease: onOpenChange,
    onSettled: () => {
      if (!open) setHeld(false);
    },
  });

  if (!scope) return null;

  return createPortal(
    <RevealDrawer
      name="aside"
      open={open}
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
