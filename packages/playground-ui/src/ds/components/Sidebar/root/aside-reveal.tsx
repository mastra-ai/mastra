import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { focusFirstIn, inertOutside } from './reveal-focus';
import { useMaybeSidebarState } from './sidebar-context';
import { REVEAL_EASE, useRevealGesture } from './use-reveal-gesture';
import { focusRingInset } from '@/ds/primitives/transitions';
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
 * Render it inside `SidebarProvider` and `AppShell`; it mounts beside the shell, not inside the page that moves.
 */
export function AsideReveal({ open, onOpenChange, label, triggerRef, children, className }: AsideRevealProps) {
  const sidebar = useMaybeSidebarState();
  if (!sidebar) throw new Error('AsideReveal must be used within a SidebarProvider.');
  const { scopeRef } = sidebar;
  const [scope, setScope] = useState<HTMLElement | null>(null);
  const [present, setPresent] = useState(open);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLButtonElement>(null);

  if (open && !present) setPresent(true);

  // A passive effect: the provider's ref on the scope attaches after its children's layout effects run.
  useEffect(() => {
    const element = scopeRef.current;
    if (!element) return;
    element.setAttribute('data-aside-reveal', '');
    element.style.setProperty('--aside-reveal-ease', REVEAL_EASE);
    setScope(element);
    return () => {
      element.removeAttribute('data-aside-reveal');
      element.removeAttribute('data-aside-reveal-open');
      element.removeAttribute('data-aside-reveal-present');
      element.style.removeProperty('--aside-reveal-ease');
    };
  }, [scopeRef]);

  useLayoutEffect(() => {
    scope?.setAttribute('data-aside-reveal-open', String(open));
    scope?.setAttribute('data-aside-reveal-present', String(present));
  }, [scope, open, present]);

  const returnFocus = useEffectEvent((root: Element) => {
    const focused = document.activeElement;
    if (!focused || focused === document.body || root.contains(focused)) {
      triggerRef?.current?.focus({ preventScroll: true });
    }
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!open || !root) return;
    const releaseOutside = inertOutside(root);
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      releaseOutside();
      returnFocus(root);
    };
  }, [open, scope]);

  useRevealGesture({
    scopeRef,
    name: 'aside',
    side: 'right',
    open,
    onGrab: () => flushSync(() => setPresent(true)),
    onRelease: onOpenChange,
    onSettled: () => {
      if (!open) setPresent(false);
    },
  });

  const closeOnEscape = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    onOpenChange(false);
  };

  if (!scope) return null;

  return createPortal(
    <div
      ref={rootRef}
      onKeyDown={closeOnEscape}
      role={open ? 'dialog' : undefined}
      aria-modal={open || undefined}
      aria-label={open ? label : undefined}
      inert={!open}
      aria-hidden={!open || undefined}
      className="in-data-[aside-reveal-present=false]:invisible"
    >
      <span tabIndex={0} className="sr-only" onFocus={() => scrimRef.current?.focus()} />
      <div
        ref={panelRef}
        data-aside-reveal-layer="panel"
        tabIndex={-1}
        className={cn(
          'fixed inset-y-0 right-0 flex w-(--aside-reveal-width) flex-col bg-sidebar pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-foreground outline-none',
          className,
        )}
      >
        {present ? children : null}
      </div>
      <button
        ref={scrimRef}
        type="button"
        aria-label={`Close ${label.toLowerCase()}`}
        data-aside-reveal-layer="scrim"
        onClick={() => onOpenChange(false)}
        className={cn('fixed inset-0 z-2 bg-fill', focusRingInset)}
      />
      <span tabIndex={0} className="sr-only" onFocus={() => focusFirstIn(panelRef.current)} />
    </div>,
    scope,
  );
}
