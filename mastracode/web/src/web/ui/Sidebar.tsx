import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { CircleUserRound, Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

import { useApiConfig } from '../../shared/api/config';
import { clearMastraCodeStorage, redirectToLogout, useFactoryAuth } from './domains/auth';
import { ThreadList } from './domains/chat';
import { FactorySection } from './domains/factory';
import { SettingsNavigation } from './domains/settings/components/SettingsNavigation';
import { useCloseSettings } from './domains/settings/hooks/useCloseSettings';
import { settingsSectionPath } from './domains/settings/settingsSections';
import {
  isServerFactory,
  FactorySwitcher,
  useActiveFactoryContext,
  UserSessionsSection,
  WorkspacesSection,
} from './domains/workspaces';

function useSettingsOpen() {
  const { pathname } = useLocation();
  return /^\/factories\/[^/]+\/settings(?:\/|$)/.test(pathname);
}

/**
 * Composition shell: each section owns its data through the domain contexts
 * (`useActiveFactoryContext`, focused chat hooks) or the router location, so
 * nothing is wired through props here.
 *
 * Everything runs in a worktree branched from the repo's HEAD. Server-backed
 * factories show the Factory menu (Board + org-level factory Sessions) and the
 * current user's personal User Sessions; each worktree holds a single
 * conversation, so there is no nested thread list. Local factories (no
 * worktrees) keep the flat thread list.
 */
export function Sidebar() {
  const { activeFactory } = useActiveFactoryContext();
  const isServerBacked = activeFactory ? isServerFactory(activeFactory) : false;
  const settingsOpen = useSettingsOpen();

  return (
    <MainSidebar className="h-full">
      <MainSidebar.Nav aria-label={settingsOpen ? 'Settings sections' : 'Main'}>
        {settingsOpen ? (
          <SettingsNavigation />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <section aria-label="Factory switcher">
              <FactorySwitcher />
            </section>
            <section className="flex min-h-0 flex-1 flex-col gap-4" aria-label="Navigation">
              {isServerBacked ? (
                <>
                  <FactorySection>
                    <WorkspacesSection />
                  </FactorySection>
                  <UserSessionsSection />
                </>
              ) : (
                <ThreadList />
              )}
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
  const { activeFactory } = useActiveFactoryContext();
  const settingsOpen = useSettingsOpen();
  const closeSettings = useCloseSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const toggleSettings = () => {
    if (settingsOpen) {
      closeSettings();
      return;
    }
    if (activeFactory) {
      void navigate(settingsSectionPath(activeFactory.id, 'general'), { state: { from: location } });
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
