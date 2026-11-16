import { useMaybeSidebarState } from './sidebar-context';
import type { SidebarPanelProps } from './sidebar-panel';
import { SidebarPanel } from './sidebar-panel';
import { frameSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

export type SidebarRootProps = SidebarPanelProps & {
  'aria-label'?: string;
  variant?: 'default' | 'raised';
};

export function SidebarRoot({
  'aria-label': ariaLabel = 'Sidebar',
  mobileMode = 'takeover',
  variant = 'default',
  children,
  ...props
}: SidebarRootProps) {
  const sidebar = useMaybeSidebarState();
  const isRaised = variant === 'raised' && !sidebar?.isMobile;

  return (
    <aside aria-label={ariaLabel} className="contents">
      <SidebarPanel mobileMode={mobileMode} {...props}>
        {isRaised ? (
          <div
            data-slot="sidebar-surface"
            className={cn(
              // 16px on the left (half of it off-screen) and 8px on the right: rows sit 10px from both visible edges,
              // like every other sidebar, and the scrollbar hugs the card's edge.
              '-mr-2 -ml-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-r-xl py-1.5 pr-2 pl-4',
              frameSurfaceStyle,
            )}
          >
            {children}
          </div>
        ) : (
          children
        )}
      </SidebarPanel>
    </aside>
  );
}
