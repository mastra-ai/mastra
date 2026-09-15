import type { MainSidebarRootProps } from '@/ds/components/MainSidebar/main-sidebar-root';
import { MainSidebarRoot } from '@/ds/components/MainSidebar/main-sidebar-root';
import { cn } from '@/lib/utils';

export type SidebarNewRootProps = MainSidebarRootProps & {
  'aria-label'?: string;
};

export function SidebarNewRoot({ 'aria-label': ariaLabel = 'Sidebar', className, ...props }: SidebarNewRootProps) {
  return (
    <aside aria-label={ariaLabel} className="contents">
      <MainSidebarRoot
        className={cn(
          'bg-sidebar text-foreground [--neutral3:var(--muted-foreground)] [--neutral5:var(--foreground)] [--neutral6:var(--foreground)] [--sidebar-nav-active:var(--selected)] [--sidebar-nav-hover:var(--sidebar-accent)]',
          className,
        )}
        {...props}
      />
    </aside>
  );
}
