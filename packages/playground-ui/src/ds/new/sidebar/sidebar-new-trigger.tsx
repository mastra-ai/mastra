import { useMaybeSidebarState } from '@/ds/components/MainSidebar/main-sidebar-context';
import type { MainSidebarTriggerProps } from '@/ds/components/MainSidebar/main-sidebar-trigger';
import { MainSidebarTrigger } from '@/ds/components/MainSidebar/main-sidebar-trigger';

export type SidebarNewTriggerProps = MainSidebarTriggerProps;

export function SidebarNewTrigger(props: SidebarNewTriggerProps) {
  const context = useMaybeSidebarState();
  if (context?.isMobile) return null;
  return <MainSidebarTrigger {...props} />;
}
