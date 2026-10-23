import { Txt } from '@mastra/playground-ui/components/Txt';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';

import { SidebarUserMenu } from './domains/auth/components/SidebarUserMenu';
import { FactorySection } from './domains/factory/components/FactorySection';
import { SettingsNavigation } from './domains/settings/components/SettingsNavigation';
import { useSettingsOpen } from './domains/settings/hooks/useSettingsOpen';
import { FactorySwitcher } from './domains/workspaces/components/FactorySwitcher';
import { SessionsSection } from './domains/workspaces/components/SessionsSection';
import { SidebarNewSessionButton } from './domains/workspaces/components/SidebarNewSessionButton';

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
        <SidebarNewSessionButton />
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
