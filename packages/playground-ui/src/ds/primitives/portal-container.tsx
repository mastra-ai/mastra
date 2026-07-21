/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';

/** Anything Base UI's `*.Portal` `container` accepts. */
export type PortalContainer =
  HTMLElement | ShadowRoot | React.RefObject<HTMLElement | ShadowRoot | null> | null | undefined;

// Why: modal SideDialog/Drawer traps focus+clicks inside its region. Popups portal to
// document.body by default → land outside the trap → unclickable. SideDialog publishes a
// node inside the trap; popups portal there instead.
//
// Sentinel is `undefined`, never `null`: Base UI reads container={undefined} as "portal to
// body", but container={null} as "not ready, render nothing" — a leaked null opens the popup
// in state but mounts it nowhere (the model-picker bug).
const PortalContainerContext = React.createContext<HTMLElement | undefined>(undefined);

export function PortalContainerProvider({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: React.ReactNode;
}) {
  // Accept null for callers; normalize so null never reaches a portal.
  return <PortalContainerContext.Provider value={container ?? undefined}>{children}</PortalContainerContext.Provider>;
}

/** Resolve a popup's portal target: explicit `container` → provider → `undefined` (body). Never null. */
export function usePortalContainer(container?: PortalContainer): Exclude<PortalContainer, null> {
  const fromContext = React.useContext(PortalContainerContext);
  return container ?? fromContext ?? undefined;
}
