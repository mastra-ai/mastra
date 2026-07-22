import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { CircleUserRound, Settings } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../../shared/api/config';
import { clearMastraCodeStorage, redirectToLogout, useFactoryAuth } from './domains/auth';
import { ThreadList } from './domains/chat';
import { FactorySection } from './domains/factory';
import { SettingsNavigation } from './domains/settings/components/SettingsNavigation';
import { useCloseSettings } from './domains/settings/hooks/useCloseSettings';
import { settingsSectionPath } from './domains/settings/settingsSections';
import { FactorySwitcher, UserSessionsSection, WorkspacesSection } from './domains/workspaces';

function useSettingsOpen() {
  const { pathname } = useLocation();
  return /^\/factories\/[^/]+\/settings(?:\/|$)/.test(pathname);
}

/**
 * Alpha status tag rendered as a dashed-outline chip (Clerk-style), so it reads
 * as a subtle stage marker rather than a solid pill competing with the nav items.
 * Tinted with the Mastra brand green (#7aff78, `--color-ds-green` on the website).
 */
function AlphaBadge() {
  return (
    <span className="relative bg-[#7aff78]/10 px-[0.1875rem] font-medium text-[0.625rem]/[0.875rem] text-[#7aff78] uppercase tracking-wide">
      Alpha
      <span className="-top-px absolute inset-x-[-0.1875rem] block transform-gpu text-[#7aff78]/40">
        <svg aria-hidden="true" height="1" stroke="currentColor" strokeDasharray="3.3 1" width="100%">
          <line x1="0" x2="100%" y1="0.5" y2="0.5" />
        </svg>
      </span>
      <span className="-bottom-px absolute inset-x-[-0.1875rem] block transform-gpu text-[#7aff78]/40">
        <svg aria-hidden="true" height="1" stroke="currentColor" strokeDasharray="3.3 1" width="100%">
          <line x1="0" x2="100%" y1="0.5" y2="0.5" />
        </svg>
      </span>
      <span className="-left-px absolute inset-y-[-0.1875rem] block transform-gpu text-[#7aff78]/40">
        <svg aria-hidden="true" height="100%" stroke="currentColor" strokeDasharray="3.3 1" width="1">
          <line x1="0.5" x2="0.5" y1="0" y2="100%" />
        </svg>
      </span>
      <span className="-right-px absolute inset-y-[-0.1875rem] block transform-gpu text-[#7aff78]/40">
        <svg aria-hidden="true" height="100%" stroke="currentColor" strokeDasharray="3.3 1" width="1">
          <line x1="0.5" x2="0.5" y1="0" y2="100%" />
        </svg>
      </span>
    </span>
  );
}

/**
 * Composition shell: each section owns its data through local query hooks,
 * focused chat hooks, or the router location, so nothing is wired through props here.
 */
export function Sidebar() {
  const settingsOpen = useSettingsOpen();

  return (
    <MainSidebar className="h-full">
      <MainSidebar.Nav aria-label={settingsOpen ? 'Settings sections' : 'Main'}>
        <div className="mt-2 mb-2 flex items-center justify-between gap-2 px-3 pt-1">
          <LogoWithoutText aria-label="Mastra" role="img" className="h-4 w-auto text-icon6" />
          <AlphaBadge />
        </div>
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
              <ThreadList />
            </section>
          </div>
        )}
      </MainSidebar.Nav>
      <MainSidebar.Bottom role="region" aria-label="Account and settings">
        <SidebarFooter />
      </MainSidebar.Bottom>
    </MainSidebar>
  );
}

function SidebarFooter() {
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
      void navigate(settingsSectionPath(factoryId, 'general'), { state: { from: location } });
    }
  };

  return (
    <MainSidebar.NavList>
      <SidebarAuth />
      <MainSidebar.NavLink
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
          <MainSidebar.NavLabel>Settings</MainSidebar.NavLabel>
        </button>
      </MainSidebar.NavLink>
    </MainSidebar.NavList>
  );
}

function SidebarAuth() {
  const auth = useFactoryAuth();
  const { baseUrl } = useApiConfig();

  if (auth.isLoading) {
    return (
      <li role="status" aria-label="Checking sign-in" className="flex h-9 items-center gap-2 px-3">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </li>
    );
  }

  // Unauthenticated sessions never reach the app (the router bounces them to
  // `/signin`), so the sidebar only renders the signed-in identity.
  const state = auth.data;
  if (!state?.authEnabled || !state.authenticated) return null;

  const identity = state.user?.name ?? state.user?.email ?? 'User';

  return (
    <MainSidebar.NavLink
      asChild
      link={{
        name: 'User',
        url: '#',
        icon: <CircleUserRound />,
      }}
    >
      <button
        type="button"
        onClick={() => {
          clearMastraCodeStorage();
          redirectToLogout(baseUrl);
        }}
        aria-label="Sign out"
        title={identity}
      >
        <CircleUserRound />
        <MainSidebar.NavLabel>{identity}</MainSidebar.NavLabel>
      </button>
    </MainSidebar.NavLink>
  );
}
