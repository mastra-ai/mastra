import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { PanelDrawer } from '@mastra/playground-ui/resize/panel-drawer';
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
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  // The registration the mobile drawer was opened for. A page mounting again registers anew,
  // so the drawer starts closed on the next page instead of covering it.
  const [drawerOpenOrder, setDrawerOpenOrder] = useState<number>();
  const isMobile = useIsMobile();
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

  const active = useMemo(() => {
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

    return active;
  }, [owners]);
  const activeOwner = active?.owner ?? null;
  const activeOrder = active?.order;

  const isDrawerOpen = activeOrder !== undefined && drawerOpenOrder === activeOrder;
  // The mobile drawer owns its own open state, so the portal must not be gated on collapse there.
  const isCollapsed = !isMobile && panelCollapsed;
  const isOpen = isMobile ? isDrawerOpen : !panelCollapsed;

  const onDrawerOpenChange = useCallback(
    (open: boolean) => setDrawerOpenOrder(open ? activeOrder : undefined),
    [activeOrder],
  );
  const toggle = useCallback(() => {
    if (isMobile) onDrawerOpenChange(!isDrawerOpen);
    else panelHandle.current?.toggle();
  }, [isMobile, isDrawerOpen, onDrawerOpenChange]);
  const onPanelResize = useCallback((sizeInPixels: number) => setPanelCollapsed(sizeInPixels <= 0), []);

  const value = useMemo(
    () => ({
      el,
      setEl,
      activeOwner,
      register,
      panelHandle,
      isCollapsed,
      isOpen,
      onPanelResize,
      isDrawerOpen,
      onDrawerOpenChange,
      toggle,
    }),
    [activeOwner, el, isCollapsed, isOpen, onPanelResize, isDrawerOpen, onDrawerOpenChange, register, toggle],
  );
  return <SidePanelContext.Provider value={value}>{children}</SidePanelContext.Provider>;
}

/** Layout-side slot. Pages portal their side panel content into this element. */
export function RouteSidePanelSlot(props: Omit<ComponentProps<'div'>, 'ref'>) {
  const ctx = use(SidePanelContext);
  return <div ref={ctx?.setEl ?? undefined} {...props} />;
}

/**
 * Layout-side, mobile: the side panel slot inside an edge drawer. It has no edge trigger of its own,
 * which would sit on the page header's actions; pages open it from their header through `toggle()`.
 */
export function RouteSidePanelDrawer({ label }: { label: string }) {
  const ctx = use(SidePanelContext);
  return (
    <PanelDrawer
      direction="right"
      label={label}
      open={ctx?.isDrawerOpen ?? false}
      onOpenChange={ctx?.onDrawerOpenChange}
    >
      <RouteSidePanelSlot className="h-full min-h-0" />
    </PanelDrawer>
  );
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
