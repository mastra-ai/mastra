import type { MainSidebarNavProps } from '@/ds/components/MainSidebar/main-sidebar-nav';
import { MainSidebarNav } from '@/ds/components/MainSidebar/main-sidebar-nav';
import { cn } from '@/lib/utils';

export type SidebarNewNavProps = MainSidebarNavProps;

export function SidebarNewNav({ children, className, ...props }: SidebarNewNavProps) {
  return (
    <MainSidebarNav
      className={cn(
        '-mr-1.5',
        '[&_[data-orientation=vertical]]:w-1 [&_[data-orientation=vertical]]:p-0',
        '[&_[data-orientation=vertical][data-has-overflow-y]]:opacity-100',
        className,
      )}
      {...props}
    >
      <div className="pr-1.5">{children}</div>
    </MainSidebarNav>
  );
}
