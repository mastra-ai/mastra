import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Circle, LogOut, Settings } from 'lucide-react';

import { useApiConfig } from '../../shared/api/config';
import { redirectToLogout, useWebAuth } from './domains/auth';
import { ThreadList, useChatConnection, useChatTranscript } from './domains/chat';
import { FactorySection } from './domains/factory';
import { ProjectSwitcher, useActiveProjectContext, UserSessionsSection, WorkspacesSection } from './domains/workspaces';
import { useOverlays } from './lib/overlays';

/**
 * Composition shell: each section owns its data through the domain contexts
 * (`useActiveProjectContext`, focused chat hooks, `useOverlays`), so nothing is
 * wired through props here.
 *
 * Everything runs in a worktree branched from the repo's HEAD. GitHub projects
 * show the Factory menu (Board + org-level factory Sessions) and the current
 * user's personal User Sessions; each worktree holds a single conversation, so
 * there is no nested thread list. Local projects (no worktrees) keep the flat
 * thread list.
 */
export function Sidebar() {
  const overlays = useOverlays();
  const { activeProject } = useActiveProjectContext();
  const open = overlays.isOpen('sidebar');
  const isGithubProject = activeProject?.source === 'github';

  return (
    <div
      className={`fixed inset-y-0 left-0 z-40 flex h-full w-[82vw] max-w-[300px] shrink-0 flex-col gap-4 border-r border-border1 bg-surface2 p-3 shadow-lg transition-transform duration-200 md:static md:z-auto md:w-full md:max-w-none md:translate-x-0 md:border-r-0 md:bg-transparent md:shadow-none ${open ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <ProjectSwitcher />
      {isGithubProject ? (
        <>
          <FactorySection>
            <WorkspacesSection />
          </FactorySection>
          <UserSessionsSection />
        </>
      ) : (
        <ThreadList />
      )}
      <SidebarFooter />
    </div>
  );
}

function statusLabel(status: string, running: boolean): string {
  if (running) return 'Working…';
  if (status === 'reconnecting') return 'Reconnecting…';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusDotClass(status: string): string {
  if (status === 'ready') return 'fill-accent1 text-accent1';
  if (status === 'reconnecting') return 'animate-pulse fill-warning1 text-warning1';
  if (status === 'error') return 'fill-error text-error';
  return 'animate-pulse fill-icon2 text-icon2';
}

function SidebarFooter() {
  const { status } = useChatConnection();
  const { busy } = useChatTranscript();
  const overlays = useOverlays();

  return (
    <div className="mt-auto flex flex-col gap-2 border-t border-border1 pt-2">
      <div
        className="grid h-10 grid-cols-[2.75rem_1fr_auto] items-center text-ui-sm text-icon3"
        role="status"
        aria-live="polite"
      >
        <span className="flex items-center justify-center">
          <Circle size={10} className={statusDotClass(status)} />
        </span>
        <span>{statusLabel(status, busy)}</span>
      </div>
      <SidebarAuth />
      <Button
        variant="ghost"
        size="sm"
        className="grid h-10 w-full grid-cols-[2.75rem_1fr_auto] items-center justify-normal gap-0 px-0"
        onClick={() => {
          overlays.open('settings');
          overlays.close('sidebar');
        }}
        aria-label="Open settings"
      >
        <span className="flex items-center justify-center">
          <Settings size={18} />
        </span>
        <span className="justify-self-start">Settings</span>
      </Button>
    </div>
  );
}

function SidebarAuth() {
  const auth = useWebAuth();
  const { baseUrl } = useApiConfig();

  if (auth.isLoading) {
    return (
      <div role="status" aria-label="Checking sign-in" className="grid h-10 grid-cols-[2.75rem_1fr_auto] items-center">
        <Skeleton className="size-6 justify-self-center rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  // Unauthenticated sessions never reach the app (the router bounces them to
  // `/signin`), so the sidebar only renders the signed-in identity.
  const state = auth.data;
  if (!state?.authEnabled || !state.authenticated) return null;

  const identity = state.user?.name ?? state.user?.email ?? 'Signed in';

  return (
    <div className="grid h-10 grid-cols-[2.75rem_1fr_auto] items-center">
      <span className="flex items-center justify-center">
        <Avatar name={identity} size="sm" />
      </span>
      <Txt as="span" variant="ui-sm" className="min-w-0 truncate text-icon6" title={identity}>
        {identity}
      </Txt>
      <Button variant="ghost" size="icon-sm" onClick={() => redirectToLogout(baseUrl)} aria-label="Sign out">
        <LogOut size={15} />
      </Button>
    </div>
  );
}
