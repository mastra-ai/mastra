import { Txt } from '@mastra/playground-ui/components/Txt';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Settings } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { SidebarAccountLink } from './domains/auth/components/SidebarAccountLink';
import { FactorySection } from './domains/factory/components/FactorySection';
import { SidebarAttention } from './domains/factory/components/SidebarAttention';
import { SidebarGlobalSearchButton } from './domains/search/components/SidebarGlobalSearchButton';
import { SettingsNavigation } from './domains/settings/components/SettingsNavigation';
import { useCloseSettings } from './domains/settings/hooks/useCloseSettings';
import { settingsSectionPath } from './domains/settings/settingsSections';
import { FactorySwitcher } from './domains/workspaces/components/FactorySwitcher';
import { UserSessionsSection } from './domains/workspaces/components/UserSessionsSection';
import { WorkspacesSection } from './domains/workspaces/components/WorkspacesSection';

function useSettingsOpen() {
  const { pathname } = useLocation();
  return /^\/factories\/[^/]+\/settings(?:\/|$)/.test(pathname);
}

function BetaBadge() {
  return (
    <Txt
      as="span"
      variant="meta"
      className="bg-badge-green-subtle text-brand-green-indicator relative m-[0.1875rem] inline-block px-[0.1875rem] align-middle uppercase"
    >
      Beta
      <span className="text-badge-green-edge absolute inset-x-[-0.1875rem] -top-px block transform-gpu">
        <svg aria-hidden="true" height="1" stroke="currentColor" strokeDasharray="3.3 1" width="100%">
          <line x1="0" x2="100%" y1="0.5" y2="0.5" />
        </svg>
      </span>
      <span className="text-badge-green-edge absolute inset-x-[-0.1875rem] -bottom-px block transform-gpu">
        <svg aria-hidden="true" height="1" stroke="currentColor" strokeDasharray="3.3 1" width="100%">
          <line x1="0" x2="100%" y1="0.5" y2="0.5" />
        </svg>
      </span>
      <span className="text-badge-green-edge absolute inset-y-[-0.1875rem] -left-px block transform-gpu">
        <svg aria-hidden="true" height="100%" stroke="currentColor" strokeDasharray="3.3 1" width="1">
          <line x1="0.5" x2="0.5" y1="0" y2="100%" />
        </svg>
      </span>
      <span className="text-badge-green-edge absolute inset-y-[-0.1875rem] -right-px block transform-gpu">
        <svg aria-hidden="true" height="100%" stroke="currentColor" strokeDasharray="3.3 1" width="1">
          <line x1="0.5" x2="0.5" y1="0" y2="100%" />
        </svg>
      </span>
    </Txt>
  );
}

/**
 * Composition shell: each section owns its data through local query hooks,
 * focused chat hooks, or the router location, so nothing is wired through props here.
 */
export function AppSidebar() {
  const settingsOpen = useSettingsOpen();

  return (
    <Sidebar aria-label="Main sidebar" className="h-full">
      <Sidebar.CommandHeader>
        <Sidebar.Brand
          logo={<LogoWithoutText aria-label="Mastra" role="img" className="text-foreground h-4 w-auto" />}
          title={<BetaBadge />}
        />
        <SidebarGlobalSearchButton />
      </Sidebar.CommandHeader>
      <Sidebar.Nav aria-label={settingsOpen ? 'Settings sections' : 'Main'}>
        {settingsOpen ? (
          <SettingsNavigation />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <section aria-label="Factory switcher">
              <FactorySwitcher />
            </section>
            <section className="flex min-h-0 flex-1 flex-col gap-4" aria-label="Navigation">
              <FactorySection>
                <WorkspacesSection />
              </FactorySection>
              <UserSessionsSection />
            </section>
          </div>
        )}
      </Sidebar.Nav>
      <Sidebar.Footer aria-label="Attention, account, and settings">
        <AppSidebarFooter />
      </Sidebar.Footer>
    </Sidebar>
  );
}

function AppSidebarFooter() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const settingsOpen = useSettingsOpen();
  const closeSettings = useCloseSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleSettings = () => {
    if (settingsOpen) {
      closeSettings();
      return;
    }
    if (factoryId) {
      void navigate(settingsSectionPath(factoryId, 'preferences'), { state: { from: location } });
    }
  };

  return (
    <Sidebar.NavList>
      <SidebarAttention />
      <SidebarAccountLink />
      <Sidebar.NavLink
        asChild
        link={{
          name: 'Settings',
          url: '#',
          icon: <Settings />,
        }}
        isActive={settingsOpen}
      >
        <button
          id="settings-trigger"
          type="button"
          onClick={toggleSettings}
          aria-label="Settings"
          aria-current={settingsOpen ? 'page' : undefined}
        >
          <Settings />
          <Sidebar.NavLabel>Settings</Sidebar.NavLabel>
        </button>
      </Sidebar.NavLink>
    </Sidebar.NavList>
  );
}
