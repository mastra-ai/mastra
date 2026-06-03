/* eslint-disable react-refresh/only-export-components */
import * as React from 'react';

/**
 * Lets a modal container (e.g. `SideDialog`'s `Drawer`) advertise a DOM node
 * that nested portaled popups should render into instead of `document.body`.
 *
 * Why this exists: Base UI's modal `Drawer` wraps its contents in a
 * `FloatingFocusManager` with `modal`, which traps focus/interaction inside the
 * drawer's floating element. A popup portaled to `document.body` (the default
 * for `Select`, `Popover`, `DropdownMenu`, `Combobox`) lands *outside* that
 * region and becomes unclickable. Portaling it into a node inside the drawer
 * keeps it within the modal region, so it stays interactive.
 *
 * Portaled components default their portal `container` to this value, so any
 * dropdown placed inside a `SideDialog` works without per-call wiring. A `null`
 * value (the default, outside any provider) means "fall back to document.body".
 */
const PortalContainerContext = React.createContext<HTMLElement | null>(null);

export function PortalContainerProvider({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: React.ReactNode;
}) {
  return <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>;
}

/** Nearest portal container node, or `null` to fall back to `document.body`. */
export function usePortalContainer(): HTMLElement | null {
  return React.useContext(PortalContainerContext);
}
