import type { MainSidebarRootProps } from '@/ds/components/MainSidebar/main-sidebar-root';
import { MainSidebarRoot } from '@/ds/components/MainSidebar/main-sidebar-root';
import { cn } from '@/lib/utils';

export type SidebarNewRootProps = MainSidebarRootProps & {
  'aria-label'?: string;
};

export function SidebarNewRoot({ 'aria-label': ariaLabel = 'Sidebar', className, ...props }: SidebarNewRootProps) {
  return (
    <aside aria-label={ariaLabel} className="contents">
      <MainSidebarRoot className={cn('bg-sidebar text-foreground', className)} {...props} />
    </aside>
  );
}
