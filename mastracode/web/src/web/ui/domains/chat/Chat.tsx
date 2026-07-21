import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useParams } from 'react-router';

import { useGithubStatusQuery } from '../../../../shared/hooks/useGithubStatus';
import { OverlaysProvider, useOverlays } from '../../lib/overlays';
import { ProjectRouteProvider } from '../../lib/ProjectRouteContext';
import { ChatLayout } from '../../ui/ChatLayout';
import { ActiveFactoryProvider } from '../workspaces/context/ActiveFactoryProvider';
import { FactoriesPanel } from '../workspaces/components/FactoriesPanel';
import { ChatOverlays } from './components/ChatOverlays';
import { ChatPermissionsProvider } from './context/ChatPermissionsProvider';
import { ChatSessionConfigProvider } from './context/ChatSessionProvider';

interface ChatProps {
  factoryId: string;
  namespace: 'local' | 'dashboard';
}

export function Chat({ factoryId, namespace }: ChatProps) {
  return (
    <MainSidebarProvider storageKey="mastracode-sidebar" mobileBreakpoint={768}>
      <ActiveFactoryProvider factoryId={factoryId}>
        <ProjectRouteProvider namespace={namespace}>
          <ChatSessionRouteProvider>
            <OverlaysProvider>
              <ChatShell />
            </OverlaysProvider>
          </ChatSessionRouteProvider>
        </ProjectRouteProvider>
      </ActiveFactoryProvider>
    </MainSidebarProvider>
  );
}

function ChatSessionRouteProvider({ children }: { children: ReactNode }) {
  const { threadId } = useParams();
  const location = useLocation();
  const userScoped = location.pathname.includes('/user/threads/');

  return (
    <ChatSessionConfigProvider threadId={threadId ? decodeURIComponent(threadId) : undefined} userScoped={userScoped}>
      <ChatPermissionsProvider>{children}</ChatPermissionsProvider>
    </ChatSessionConfigProvider>
  );
}

function ChatShell() {
  const overlays = useOverlays();
  const githubStatus = useGithubStatusQuery();
  const factoryPanel = overlays.isOpen('factories') ? (
    <FactoriesPanel
      onOpenGithub={
        githubStatus.data
          ? () => {
              overlays.close('factories');
              overlays.open('github');
            }
          : undefined
      }
      onClose={() => overlays.close('factories')}
    />
  ) : undefined;

  return (
    <>
      <ChatLayout main={factoryPanel ?? <Outlet />} />
      <ChatOverlays />
    </>
  );
}
