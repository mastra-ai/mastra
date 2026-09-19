import type { ComponentPropsWithRef, ReactNode } from 'react';

import { SidebarNew } from '../../sidebar/sidebar-new';
import type { MainSidebarProviderProps } from '@/ds/components/MainSidebar/main-sidebar-provider';
import { cn } from '@/lib/utils';

export interface AppLayoutProps extends ComponentPropsWithRef<'div'> {
  sidebar: ReactNode;
  mobileHeader?: ReactNode;
  mobileMode?: 'drawer' | 'takeover';
  sidebarProviderProps?: Omit<MainSidebarProviderProps, 'children' | 'mobileBreakpoint'>;
}

export function AppLayout({
  children,
  className,
  sidebar,
  mobileHeader,
  mobileMode = 'takeover',
  sidebarProviderProps,
  ...props
}: AppLayoutProps) {
  return (
    <SidebarNew.Provider {...sidebarProviderProps} mobileBreakpoint={1024}>
      <div
        data-slot="app-layout"
        className={cn('new-theme flex h-dvh min-h-0 w-full overflow-hidden bg-sidebar text-foreground', className)}
        {...props}
      >
        <SidebarNew mobileMode={mobileMode}>{sidebar}</SidebarNew>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header
            data-slot="app-layout-mobile-header"
            className="flex shrink-0 items-center gap-2 px-2 pt-[env(safe-area-inset-top)] lg:hidden"
          >
            <SidebarNew.MobileTrigger />
            {mobileHeader}
          </header>
          {children}
        </div>
      </div>
    </SidebarNew.Provider>
  );
}
