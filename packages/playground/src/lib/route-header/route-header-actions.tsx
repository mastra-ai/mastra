import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ActionOwner {
  owner: string;
  priority: number;
  order: number;
}

interface ActionsSlotState {
  el: HTMLElement | null;
  setEl: Dispatch<SetStateAction<HTMLElement | null>>;
  activeOwner: string | null;
  register: (owner: string, priority: number) => () => void;
}

const ActionsSlotContext = createContext<ActionsSlotState | null>(null);

/**
 * Wraps the entire layout subtree so both `<RouteHeader/>` (which renders the
 * slot div) and pages (which portal into it) share the same DOM target.
 */
export function RouteHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [owners, setOwners] = useState<ActionOwner[]>([]);
  const orderRef = useRef(0);

  const register = useCallback((owner: string, priority: number) => {
    const order = orderRef.current + 1;
    orderRef.current = order;

    setOwners(current => [...current.filter(entry => entry.owner !== owner), { owner, priority, order }]);

    return () => {
      setOwners(current => current.filter(entry => !(entry.owner === owner && entry.order === order)));
    };
  }, []);

  const activeOwner = useMemo(() => {
    let active: ActionOwner | undefined;
    for (const owner of owners) {
      if (
        !active ||
        owner.priority > active.priority ||
        (owner.priority === active.priority && owner.order > active.order)
      ) {
        active = owner;
      }
    }

    return active?.owner ?? null;
  }, [owners]);

  const value = useMemo(() => ({ el, setEl, activeOwner, register }), [activeOwner, el, register]);
  return <ActionsSlotContext.Provider value={value}>{children}</ActionsSlotContext.Provider>;
}

/**
 * Layout-side slot. Renders an element whose ref is published through the
 * shared context, so descendant pages can portal into it.
 */
export function RouteHeaderActionsSlot({ className }: { className?: string }) {
  const ctx = use(ActionsSlotContext);
  return <div ref={ctx?.setEl ?? undefined} className={className} />;
}

/**
 * Page-side: portals the active owner into the layout's header action slot.
 * No-op when the layout doesn't render `<RouteHeader/>` (e.g., minimal layout).
 */
export function RouteHeaderActions({
  owner,
  priority = 0,
  children,
}: {
  owner: string;
  priority?: number;
  children: ReactNode;
}) {
  const ctx = use(ActionsSlotContext);
  const register = ctx?.register;

  useEffect(() => {
    if (!register) return;
    return register(owner, priority);
  }, [owner, priority, register]);

  if (!ctx?.el || ctx.activeOwner !== owner) return null;
  return createPortal(children, ctx.el);
}
