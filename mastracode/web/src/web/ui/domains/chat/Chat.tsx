import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import type { ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router';

import { Sidebar } from '../../Sidebar';
import { ChatLayout } from '../../ui/ChatLayout';

import { OverlaysProvider, useOverlays } from '../../lib/overlays';
import { FactoriesPanel } from '../workspaces/components/FactoriesPanel';
import { ActiveFactoryProvider, useActiveFactoryContext } from '../workspaces/context/ActiveFactoryProvider';
import { useGithubStatusQuery } from '../../../../shared/hooks/useGithubStatus';
import { ChatHeader } from './components/ChatHeader';
import { ChatOverlays } from './components/ChatOverlays';
import { ChatSessionConfigProvider } from './context/ChatSessionProvider';
import { ChatPermissionsProvider } from './context/ChatPermissionsProvider';

/**
 * Shared chat app providers. Route leaves render their own pages so `/new` is a
 * real page boundary instead of a branch inside the thread transcript.
 */
export default function Chat() {
  return (
    <MainSidebarProvider storageKey="mastracode-web" collapsedWidth={0} mobileBreakpoint={768}>
      <ActiveFactoryProvider>
        <ChatSessionRouteProvider>
          <OverlaysProvider>
            <ChatShell />
          </OverlaysProvider>
        </ChatSessionRouteProvider>
      </ActiveFactoryProvider>
    </MainSidebarProvider>
  );
}

function ChatSessionRouteProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const userScoped = pathname.startsWith('/user/threads/');
  const threadId = userScoped
    ? decodeURIComponent(pathname.slice('/user/threads/'.length))
    : pathname.startsWith('/threads/')
      ? decodeURIComponent(pathname.slice('/threads/'.length))
      : undefined;

  return (
    <ChatSessionConfigProvider threadId={threadId} userScoped={userScoped}>
      <ChatPermissionsProvider>{children}</ChatPermissionsProvider>
    </ChatSessionConfigProvider>
  );
}

function ChatShell() {
  const overlays = useOverlays();
  const { factories, factoriesPending } = useActiveFactoryContext();
  const githubStatus = useGithubStatusQuery().data;
  const githubEnabled = !!githubStatus && (githubStatus.enabled || !!githubStatus.authRequired);
  const factorySetupRequired = factories.length === 0 && !factoriesPending;
  const factoriesOpen = (overlays.isOpen('factories') || factorySetupRequired) && !overlays.isOpen('github');
  const content = factoriesOpen ? (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      main={
        <FactoriesPanel
          onOpenGithub={
            githubEnabled
              ? () => {
                  overlays.close('factories');
                  overlays.open('github');
                }
              : undefined
          }
          onClose={factorySetupRequired ? undefined : () => overlays.close('factories')}
        />
      }
    />
  ) : (
    <Outlet />
  );

  return (
    <>
      {content}
      <ChatOverlays />
    </>
  );
}
