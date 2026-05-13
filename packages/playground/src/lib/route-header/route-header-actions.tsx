import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

interface ActionsSlotState {
  el: HTMLElement | null;
  setEl: Dispatch<SetStateAction<HTMLElement | null>>;
}

const ActionsSlotContext = createContext<ActionsSlotState | null>(null);

/**
 * Wraps the entire layout subtree so both `<RouteHeader/>` (which renders the
 * slot div) and pages (which portal into it) share the same DOM target.
 */
export function RouteHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ el, setEl }), [el]);
  return <ActionsSlotContext.Provider value={value}>{children}</ActionsSlotContext.Provider>;
}

/**
 * Layout-side slot. Renders an element whose ref is published through the
 * shared context, so descendant pages can portal into it.
 */
export function RouteHeaderActionsSlot({ className }: { className?: string }) {
  const ctx = useContext(ActionsSlotContext);
  return <div ref={ctx?.setEl ?? undefined} className={className} />;
}

/**
 * Page-side: portals children into the layout's header action slot. No-op when
 * the layout doesn't render `<RouteHeader/>` (e.g., minimal layout).
 */
export function RouteHeaderActions({ children }: { children: ReactNode }) {
  const ctx = useContext(ActionsSlotContext);
  if (!ctx?.el) return null;
  return createPortal(children, ctx.el);
}
