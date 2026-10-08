import { useSidebarSlot } from './sidebar-slot-context';

export function SidebarSlot() {
  const slot = useSidebarSlot();
  return <div ref={slot?.registerTarget} className="flex min-h-0 min-w-0 flex-1 flex-col" />;
}
