import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { CircleUserRound, Settings } from 'lucide-react';

import { useApiConfig } from '../../shared/api/config';
import { redirectToLogout, useWebAuth } from './domains/auth';
import { ThreadList } from './domains/chat';
import { FactorySection } from './domains/factory';
import {
  isGithubFactory,
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
 * Everything runs in a worktree branched from the repo's HEAD. GitHub factories
 * show the Factory menu (Board + org-level factory Sessions) and the current
 * user's personal User Sessions; each worktree holds a single conversation, so
 * there is no nested thread list. Local factories (no worktrees) keep the flat
 * thread list.
 */
export function Sidebar() {
  const { activeFactory } = useActiveFactoryContext();
  const isGithub = activeFactory ? isGithubFactory(activeFactory) : false;

  return (
    <MainSidebar className="bg-transparent h-full">
      <MainSidebar.Nav>
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <section aria-label="Factory switcher">
            <FactorySwitcher />
          </section>
          <section className="flex min-h-0 flex-1 flex-col gap-4" aria-label="Navigation">
            {isGithub ? (
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
      </MainSidebar.Nav>
      <MainSidebar.Bottom role="region" aria-label="Account and settings" className="pb-3">
        <SidebarFooter />
      </MainSidebar.Bottom>
    </MainSidebar>
  );
}

function SidebarFooter() {
  const overlays = useOverlays();

  return (
    <>
      <MainSidebar.NavSeparator />
      <MainSidebar.NavList>
        <SidebarAuth />
        <MainSidebar.NavLink
          asChild
          link={{
            name: 'Settings',
            url: '#',
            icon: <Settings />,
          }}
        >
          <button type="button" onClick={() => overlays.open('settings')} aria-label="Open settings">
            <Settings />
            <MainSidebar.NavLabel>Settings</MainSidebar.NavLabel>
          </button>
        </MainSidebar.NavLink>
      </MainSidebar.NavList>
    </>
  );
}

function SidebarAuth() {
  const auth = useWebAuth();
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
      <button type="button" onClick={() => redirectToLogout(baseUrl)} aria-label="Sign out" title={identity}>
        <CircleUserRound />
        <MainSidebar.NavLabel>{identity}</MainSidebar.NavLabel>
      </button>
    </MainSidebar.NavLink>
  );
}
