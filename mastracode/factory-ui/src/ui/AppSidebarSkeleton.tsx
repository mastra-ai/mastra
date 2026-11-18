import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { AppSidebarLayout, MainNavigationLayout } from './AppSidebar';
import { SidebarSettingsLinkSkeleton } from './domains/auth/components/SidebarSettingsLinkSkeleton';
import { FactorySectionLayout } from './domains/factory/components/FactorySection';
import { FactorySwitcherSkeleton } from './domains/workspaces/components/FactorySwitcherSkeleton';
import { SessionRowsSkeleton } from './domains/workspaces/components/SessionRowsSkeleton';
import { SessionsSectionLayout } from './domains/workspaces/components/SessionsSection';
import { useSessionListView } from './domains/workspaces/hooks/useSessionListView';
import { SidebarNavigationSkeleton, SidebarNavListSkeleton } from './ui/SidebarNavigationSkeleton';

export function AppSidebarSkeleton() {
  const { view } = useSessionListView();

  return (
    <div aria-hidden inert className="contents">
      <AppSidebarLayout
        switcher={<FactorySwitcherSkeleton />}
        search={<Skeleton className="size-control-sm shrink-0 rounded-full motion-reduce:before:animate-none" />}
        navLabel="Main"
        footer={<SidebarSettingsLinkSkeleton />}
      >
        <MainNavigationLayout
          newSession={<SidebarNavListSkeleton />}
          sections={
            <>
              <FactorySectionLayout>
                <li>
                  <SidebarNavigationSkeleton label="Loading boards" rows={1} />
                </li>
              </FactorySectionLayout>
              <SessionsSectionLayout list={<SessionRowsSkeleton label="Loading sessions" compact={view.compact} />} />
            </>
          }
        />
      </AppSidebarLayout>
    </div>
  );
}
