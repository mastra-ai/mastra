import { useEffect, useLayoutEffect, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useSidebar } from './sidebar-context';
import { REVEAL_EASE, useRevealGesture } from './use-reveal-gesture';
import { focusRingInset } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

import './sidebar-reveal.css';

const REVEAL_EASE_VAR = '--sidebar-reveal-ease';

type SidebarRevealProps = {
  children: ReactNode;
  className?: string;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
};

export function SidebarReveal({ children, className, onClick }: SidebarRevealProps) {
  const { scopeRef, openMobile, mobileTriggerRef, setOpenMobile, setMobileDrawerPresent } = useSidebar();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  useLayoutEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    scope.setAttribute('data-sidebar-reveal', '');
    scope.style.setProperty(REVEAL_EASE_VAR, REVEAL_EASE);
    return () => {
      scope.removeAttribute('data-sidebar-reveal');
      scope.style.removeProperty(REVEAL_EASE_VAR);
    };
  }, [scopeRef]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!openMobile || !root) return;
    return inertOutside(root);
  }, [openMobile]);

  useRevealGesture({
    scopeRef,
    open: openMobile,
    onGrab: () => flushSync(() => setMobileDrawerPresent(true)),
    onRelease: setOpenMobile,
    onSettled: () => {
      if (!openMobile) setMobileDrawerPresent(false);
    },
  });

  useEffect(() => {
    if (openMobile) {
      wasOpenRef.current = true;
      panelRef.current?.focus({ preventScroll: true });
      return;
    }
    if (!wasOpenRef.current) return;
    wasOpenRef.current = false;
    const focused = document.activeElement;
    if (!focused || focused === document.body || rootRef.current?.contains(focused)) {
      mobileTriggerRef.current?.focus({ preventScroll: true });
    }
  }, [openMobile, mobileTriggerRef]);

  useEffect(() => {
    if (!openMobile) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      setOpenMobile(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [openMobile, setOpenMobile]);

  return (
    <div
      ref={rootRef}
      role={openMobile ? 'dialog' : undefined}
      aria-modal={openMobile || undefined}
      aria-label={openMobile ? 'Navigation' : undefined}
      data-mobile-mode="takeover"
      inert={!openMobile}
      aria-hidden={!openMobile || undefined}
      className="in-data-[sidebar-mobile-present=false]:invisible"
    >
      <div
        ref={panelRef}
        data-sidebar-reveal-layer="panel"
        tabIndex={-1}
        onClick={onClick}
        className={cn(
          'fixed inset-y-0 left-0 w-(--sidebar-reveal-width) bg-sidebar pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-foreground outline-none',
          className,
        )}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-2">{children}</div>
      </div>
      <button
        type="button"
        aria-label="Close navigation menu"
        data-sidebar-reveal-layer="scrim"
        onClick={() => setOpenMobile(false)}
        className={cn('fixed inset-0 z-2 bg-fill', focusRingInset)}
      />
    </div>
  );
}

function inertOutside(root: Element) {
  const marked: Element[] = [];
  let node = root;
  while (node !== document.body && node.parentElement) {
    const parent = node.parentElement;
    for (const sibling of parent.children) {
      if (sibling === node || sibling.hasAttribute('inert')) continue;
      sibling.setAttribute('inert', '');
      marked.push(sibling);
    }
    node = parent;
  }
  return () => {
    for (const element of marked) element.removeAttribute('inert');
  };
}
