import { useEffect, useEffectEvent, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent, ReactNode, RefObject } from 'react';
import type { RevealName } from './use-reveal-gesture';
import { focusRingInset } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const TABBABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';

type RevealDrawerProps = {
  /** Namespaces the layer attributes the reveal gesture and stylesheet drive: `data-<name>-reveal-layer`. */
  name: RevealName;
  open: boolean;
  /** Out at all: open, dragged, or settling closed. Hidden when false. */
  present: boolean;
  label: string;
  closeLabel: string;
  onClose: () => void;
  /** Takes focus back when the drawer closes. */
  triggerRef: RefObject<HTMLElement | null> | undefined;
  /** Positions and sizes the panel against its edge. */
  panelClassName: string;
  onPanelClick?: (event: MouseEvent<HTMLDivElement>) => void;
  children: ReactNode;
};

/**
 * The markup both edge drawers share: a modal panel, a scrim over the uncovered page, and a focus trap.
 * Motion comes from the reveal stylesheets reading the layer attributes; the gesture lives in `useRevealGesture`.
 */
export function RevealDrawer({
  name,
  open,
  present,
  label,
  closeLabel,
  onClose,
  triggerRef,
  panelClassName,
  onPanelClick,
  children,
}: RevealDrawerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLButtonElement>(null);
  const layerAttr = `data-${name}-reveal-layer`;

  const returnFocus = useEffectEvent((root: Element, opener: HTMLElement | null) => {
    const focused = document.activeElement;
    if (!focused || focused === document.body || root.contains(focused)) {
      (triggerRef?.current ?? opener)?.focus({ preventScroll: true });
    }
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!open || !root) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const releaseOutside = inertOutside(root);
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      releaseOutside();
      returnFocus(root, opener);
    };
  }, [open]);

  const closeOnEscape = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    onClose();
  };

  return (
    <div
      ref={rootRef}
      onKeyDown={closeOnEscape}
      role={open ? 'dialog' : undefined}
      aria-modal={open || undefined}
      aria-label={open ? label : undefined}
      inert={!open}
      aria-hidden={!open || undefined}
      data-reveal-drawer={name}
      data-open={open}
      data-present={present}
      className="data-[present=false]:invisible"
    >
      <span tabIndex={0} className="sr-only" onFocus={() => scrimRef.current?.focus()} />
      <div
        ref={panelRef}
        {...{ [layerAttr]: 'panel' }}
        tabIndex={-1}
        onClick={onPanelClick}
        className={cn(
          'fixed inset-y-0 bg-sidebar pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-foreground outline-none',
          panelClassName,
        )}
      >
        {children}
      </div>
      <button
        ref={scrimRef}
        type="button"
        aria-label={closeLabel}
        {...{ [layerAttr]: 'scrim' }}
        onClick={onClose}
        className={cn('fixed inset-0 z-2 bg-fill', focusRingInset)}
      />
      <span tabIndex={0} className="sr-only" onFocus={() => focusFirstIn(panelRef.current)} />
    </div>
  );
}

function focusFirstIn(container: HTMLElement | null) {
  if (!container) return;
  for (const candidate of container.querySelectorAll(TABBABLE)) {
    if (!(candidate instanceof HTMLElement) || candidate.tabIndex < 0) continue;
    candidate.focus();
    if (document.activeElement === candidate) return;
  }
  container.focus();
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
