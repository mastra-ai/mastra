import type { MainSidebarRootProps } from '@/ds/components/MainSidebar/main-sidebar-root';
import { MainSidebarRoot } from '@/ds/components/MainSidebar/main-sidebar-root';

export type SidebarNewRootProps = MainSidebarRootProps & {
  'aria-label'?: string;
};

export function SidebarNewRoot({ 'aria-label': ariaLabel = 'Sidebar', ...props }: SidebarNewRootProps) {
  return (
    <aside aria-label={ariaLabel} className="contents">
      <MainSidebarRoot {...props} />
    </aside>
  );
}
