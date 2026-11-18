import { AppSidebarLayout, MainNavigationLayout } from './AppSidebar';
import { SidebarSettingsLinkSkeleton } from './domains/auth/components/SidebarSettingsLinkSkeleton';
import { FactorySectionLayout } from './domains/factory/components/FactorySection';
import { SidebarGlobalSearchTrigger } from './domains/search/components/SidebarGlobalSearchButton';
import { FactorySwitcherSkeleton } from './domains/workspaces/components/FactorySwitcherSkeleton';
import { SessionRowsSkeleton } from './domains/workspaces/components/SessionRowsSkeleton';
import { SessionsSectionLayout } from './domains/workspaces/components/SessionsSection';
import { useSessionListView } from './domains/workspaces/hooks/useSessionListView';
import { SidebarNavigationSkeleton, SidebarNavListSkeleton } from './ui/SidebarNavigationSkeleton';

export function AppSidebarSkeleton() {
  const { view } = useSessionListView();

  return (
    <AppSidebarLayout
      switcher={<FactorySwitcherSkeleton />}
      search={
        <div inert className="contents">
          <SidebarGlobalSearchTrigger />
        </div>
      }
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
  );
}
