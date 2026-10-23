import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';

import { SidebarUserMenu } from './domains/auth/components/SidebarUserMenu';
import { FactorySection } from './domains/factory/components/FactorySection';
import { SidebarGlobalSearchButton } from './domains/search/components/SidebarGlobalSearchButton';
import { SettingsNavigation } from './domains/settings/components/SettingsNavigation';
import { useSettingsOpen } from './domains/settings/hooks/useSettingsOpen';
import { FactorySwitcher } from './domains/workspaces/components/FactorySwitcher';
import { SessionsSection } from './domains/workspaces/components/SessionsSection';
import { SidebarNewSessionButton } from './domains/workspaces/components/SidebarNewSessionButton';

/**
 * Composition shell: each section owns its data through local query hooks,
 * focused chat hooks, or the router location, so nothing is wired through props here.
 */
export function AppSidebar() {
  const settingsOpen = useSettingsOpen();
  const pageHeaderOwnsToggle = useSidebar().desktopState === 'collapsed';

  return (
    <Sidebar aria-label="Main sidebar" className="h-full">
      <Sidebar.CommandHeader>
        <LogoWithoutText aria-label="Mastra" role="img" className="text-foreground h-4 w-auto shrink-0" />
        <FactorySwitcher />
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <SidebarGlobalSearchButton />
          {!pageHeaderOwnsToggle && <Sidebar.Trigger />}
        </div>
      </Sidebar.CommandHeader>
      <Sidebar.Nav aria-label={settingsOpen ? 'Settings sections' : 'Main'}>
        {settingsOpen ? (
          <SettingsNavigation />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <SidebarNewSessionButton />
            <section className="flex min-h-0 flex-1 flex-col gap-4" aria-label="Navigation">
              <FactorySection />
              <SessionsSection />
            </section>
          </div>
        )}
      </Sidebar.Nav>
      <Sidebar.Footer aria-label="Account and settings">
        <Sidebar.NavList>
          <SidebarUserMenu />
        </Sidebar.NavList>
      </Sidebar.Footer>
    </Sidebar>
  );
}
