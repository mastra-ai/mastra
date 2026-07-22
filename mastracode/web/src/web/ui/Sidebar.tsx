import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { CircleUserRound, Settings } from 'lucide-react';

import { useApiConfig } from '../../shared/api/config';
import { redirectToLogout, useFactoryAuth } from './domains/auth';
import { ThreadList } from './domains/chat';
import { FactorySection } from './domains/factory';
import { SettingsNavigation } from './domains/settings/components/SettingsNavigation';
import { useSetSettingsSection } from './domains/settings/context/SettingsNavigationProvider';
import { useCloseSettings } from './domains/settings/hooks/useCloseSettings';
import {
  isServerFactory,
  FactorySwitcher,
  useActiveFactoryContext,
  UserSessionsSection,
  WorkspacesSection,
} from './domains/workspaces';
import { useOverlays } from './lib/overlays';

/**
 * Composition shell: each section owns its data through the domain contexts
 * (`useActiveFactoryContext`, focused chat hooks, `useOverlays`), so nothing is
 * wired through props here.
 *
 * Everything runs in a worktree branched from the repo's HEAD. Server-backed
 * factories show the Factory menu (Board + org-level factory Sessions) and the
 * current user's personal User Sessions; each worktree holds a single
 * conversation, so there is no nested thread list. Local factories (no
 * worktrees) keep the flat thread list.
 */
export function Sidebar() {
  const { activeFactory } = useActiveFactoryContext();
  const overlays = useOverlays();
  const isServerBacked = activeFactory ? isServerFactory(activeFactory) : false;
  const settingsOpen = overlays.isOpen('settings');

  return (
    <MainSidebar className="bg-transparent h-full">
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
  const overlays = useOverlays();
  const settingsOpen = overlays.isOpen('settings');
  const setSettingsSection = useSetSettingsSection();
  const closeSettings = useCloseSettings();

  const toggleSettings = () => {
    if (settingsOpen) {
      closeSettings();
      return;
    }
    setSettingsSection('general');
    overlays.open('settings');
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
          localStorage.clear();
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
