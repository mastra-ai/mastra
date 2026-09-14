import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import type { ComponentProps, ReactNode } from 'react';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SidePanelContext } from './side-panel-context';

interface PanelOwner {
  owner: string;
  priority: number;
  order: number;
}

/**
 * Wraps the layout subtree so the layout (which renders the resizable panel and
 * the slot div) and pages (which portal content into it) share the same state.
 */
export function RouteSidePanelProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [owners, setOwners] = useState<PanelOwner[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const panelHandle = useRef<CollapsiblePanelHandle | null>(null);
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
    let active: PanelOwner | undefined;
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

  const toggle = useCallback(() => panelHandle.current?.toggle(), []);

  const value = useMemo(
    () => ({ el, setEl, activeOwner, register, panelHandle, isCollapsed, setIsCollapsed, toggle }),
    [activeOwner, el, isCollapsed, register, toggle],
  );
  return <SidePanelContext.Provider value={value}>{children}</SidePanelContext.Provider>;
}

/** Layout-side slot. Pages portal their side panel content into this element. */
export function RouteSidePanelSlot(props: Omit<ComponentProps<'div'>, 'ref'>) {
  const ctx = use(SidePanelContext);
  return <div ref={ctx?.setEl ?? undefined} {...props} />;
}

/** Page-side: registers an owner and portals its content into the layout's side panel slot. */
export function RouteSidePanel({
  owner,
  priority = 0,
  children,
}: {
  owner: string;
  priority?: number;
  children: ReactNode;
}) {
  const ctx = use(SidePanelContext);
  const register = ctx?.register;

  useEffect(() => {
    if (!register) return;
    return register(owner, priority);
  }, [owner, priority, register]);

  if (!ctx?.el || ctx.activeOwner !== owner) return null;
  return createPortal(children, ctx.el);
}
