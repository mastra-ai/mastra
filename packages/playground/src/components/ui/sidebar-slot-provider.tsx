import type { ReactNode } from 'react';
import { SidebarSlotContext } from './sidebar-slot-context';
import { useSidebarSlotTarget } from './use-sidebar-slot-target';

/** The route owns the slot; view providers remain attached to their portaled controls. */
export function SidebarSlotProvider({ children }: { children: ReactNode }) {
  const slot = useSidebarSlotTarget();
  return <SidebarSlotContext value={slot}>{children}</SidebarSlotContext>;
}
