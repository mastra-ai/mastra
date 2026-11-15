import { useEffect, useLayoutEffect, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useSidebar } from './sidebar-context';
import { REVEAL_SCOPE_VARS, useRevealGesture } from './use-reveal-gesture';
import { focusRingInset } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

import './sidebar-reveal.css';

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
    for (const [name, value] of Object.entries(REVEAL_SCOPE_VARS)) scope.style.setProperty(name, value);
    return () => {
      scope.removeAttribute('data-sidebar-reveal');
      for (const name of Object.keys(REVEAL_SCOPE_VARS)) scope.style.removeProperty(name);
    };
  }, [scopeRef]);

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
    const root = rootRef.current;
    if (!openMobile || !root) return;
    return inertOutside(root);
  }, [openMobile]);

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

const LIVE_REGION = '[aria-live], [role="status"], [role="alert"], [role="log"]';

function inertOutside(root: Element) {
  const marked: Element[] = [];
  const markInert = (element: Element) => {
    if (element.hasAttribute('inert') || element.matches(LIVE_REGION)) return;
    if (element.querySelector(LIVE_REGION)) {
      for (const child of element.children) markInert(child);
      return;
    }
    element.setAttribute('inert', '');
    marked.push(element);
  };
  let node = root;
  let parent = root.parentElement;
  while (parent && node !== document.body) {
    for (const sibling of parent.children) {
      if (sibling !== node) markInert(sibling);
    }
    node = parent;
    parent = parent.parentElement;
  }
  return () => {
    for (const element of marked) element.removeAttribute('inert');
  };
}
