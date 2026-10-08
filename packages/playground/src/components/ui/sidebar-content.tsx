import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSidebarSlot } from './sidebar-slot-context';

export function SidebarContent({ children }: { children: ReactNode }) {
  const slot = useSidebarSlot();
  return slot?.target ? createPortal(children, slot.target) : null;
}
