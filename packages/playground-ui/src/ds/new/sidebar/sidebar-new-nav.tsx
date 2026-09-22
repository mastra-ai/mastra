import { useMaybeSidebarState } from '@/ds/components/MainSidebar/main-sidebar-context';
import type { MainSidebarNavProps } from '@/ds/components/MainSidebar/main-sidebar-nav';
import { MainSidebarNav } from '@/ds/components/MainSidebar/main-sidebar-nav';
import { cn } from '@/lib/utils';

export type SidebarNewNavProps = MainSidebarNavProps;

export function SidebarNewNav({ children, className, ...props }: SidebarNewNavProps) {
  const isMobile = useMaybeSidebarState()?.isMobile ?? false;

  return (
    <MainSidebarNav
      className={cn(
        '-mr-1.5',
        '[&_[data-orientation=vertical]]:w-1 [&_[data-orientation=vertical]]:p-0',
        '[&_[data-orientation=vertical][data-has-overflow-y]]:opacity-100',
        isMobile && '[&_a]:min-h-11 [&_a]:touch-manipulation [&_button]:min-h-11 [&_button]:touch-manipulation',
        className,
      )}
      {...props}
    >
      <div className="pr-1.5">{children}</div>
    </MainSidebarNav>
  );
}
