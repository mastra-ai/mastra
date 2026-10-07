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
  className,
  children,
  ...props
}: SidebarRootProps) {
  const sidebar = useMaybeSidebarState();
  const isMobile = sidebar?.isMobile ?? false;
  const isRaised = variant === 'raised' && !isMobile;

  return (
    <aside aria-label={ariaLabel} className="contents">
      <SidebarPanel
        mobileMode={mobileMode}
        // Takes `AppShell`'s top inset so the header lines up with the page header; 0 outside the shell.
        // The raised surface brings its own margin, and the mobile drawer its safe-area padding.
        className={cn(!isMobile && !isRaised && 'pt-[var(--app-shell-inset-top,0px)]', className)}
        {...props}
      >
        {isRaised ? (
          <div
            data-slot="sidebar-surface"
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
      </SidebarPanel>
    </aside>
  );
}
