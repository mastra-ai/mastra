import { useMaybeSidebarState } from '@/ds/components/MainSidebar/main-sidebar-context';
import type { MainSidebarRootProps } from '@/ds/components/MainSidebar/main-sidebar-root';
import { MainSidebarRoot } from '@/ds/components/MainSidebar/main-sidebar-root';
import { frameSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export type SidebarNewRootProps = MainSidebarRootProps & {
  'aria-label'?: string;
  variant?: 'default' | 'raised';
};

export function SidebarNewRoot({
  'aria-label': ariaLabel = 'Sidebar',
  mobileMode = 'takeover',
  variant = 'default',
  children,
  ...props
}: SidebarNewRootProps) {
  const sidebar = useMaybeSidebarState();
  const isRaised = variant === 'raised' && !sidebar?.isMobile;

  return (
    <aside aria-label={ariaLabel} className="contents">
      <MainSidebarRoot mobileMode={mobileMode} {...props}>
        {isRaised ? (
          <div
            data-slot="sidebar-new-surface"
            className={cn(
              'my-2 -mr-2 -ml-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-r-xl py-1.5',
              sidebar?.state === 'collapsed' ? 'pr-2 pl-4' : 'pr-3.5 pl-5.5',
              frameSurfaceStyle,
            )}
          >
            {children}
          </div>
        ) : (
          children
        )}
      </MainSidebarRoot>
    </aside>
  );
}
