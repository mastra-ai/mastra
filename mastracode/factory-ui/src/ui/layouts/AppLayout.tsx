import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { AppShell, MainCard } from '@mastra/playground-ui/new/layout/app-shell';
import { Outlet } from 'react-router';

import { BoardDraftProvider } from '../domains/boardConfig/BoardDraftProvider';
import { useBoardConfigRoute } from '../domains/boardConfig/hooks/useBoardConfigRoute';
import { ChatSessionRouteProvider } from '../domains/chat/Chat';
import { ChatOverlays } from '../domains/chat/components/ChatOverlays';
import { useServerStatus } from '../../hooks/useServerStatus';
import { OverlaysProvider } from '../lib/overlays';
import { PwaInstallBanner } from '../lib/pwa';
import { AppSidebar } from '../AppSidebar';
import { ServerProblemBanner } from './ServerProblemBanner';

const DEFAULT_MIN_WIDTH = 200;
const BOARD_CONFIG_MIN_WIDTH = 288;

/** `[` toggles the sidebar, as the trigger's tooltip says. Needs the `Sidebar.Provider` context. */
function SidebarShortcuts() {
  const { toggleSidebar } = useSidebar();
  useKeydown({ '[': toggleSidebar }, { repeat: false });
  return null;
}

function AppFrame() {
  const { state, collapsedWidth } = useSidebar();
  const edgeToEdge = state === 'collapsed' && collapsedWidth === 0;
  return (
    <AppShell sidebar={<AppSidebar />} edgeToEdge={edgeToEdge}>
      <MainCard className="flex flex-col" edgeToEdge={edgeToEdge}>
        <Outlet />
      </MainCard>
    </AppShell>
  );
}

/**
 * Application frame rendered once at the router level: sidebar + page card
 * around the routed page. Pages render only their body (see `PageLayout`).
 * Mounted under `FactoryLayout` so the sidebar only ever sees a valid factory.
 * The mobile PWA install banner takes the top row so it never covers the page.
 */
export function AppLayout() {
  const problem = useServerStatus().data?.problems[0];
  // Board configuration lists phases by name beside the page that edits them, so the sidebar
  // widens a little while it is open. The stored width is kept and returns when it closes.
  const configuringBoard = useBoardConfigRoute() !== undefined;

  return (
    <div className="bg-sidebar flex h-dvh flex-col">
      {problem ? <ServerProblemBanner problem={problem} /> : null}
      <PwaInstallBanner />
      <div className="min-h-0 flex-1">
        <Sidebar.Provider
          storageKey="mastracode-web"
          collapsedWidth={0}
          minWidth={configuringBoard ? BOARD_CONFIG_MIN_WIDTH : DEFAULT_MIN_WIDTH}
          collapseBelow={DEFAULT_MIN_WIDTH}
        >
          <SidebarShortcuts />
          <OverlaysProvider>
            <ChatSessionRouteProvider>
              <BoardDraftProvider>
                <AppFrame />
              </BoardDraftProvider>
              <ChatOverlays />
            </ChatSessionRouteProvider>
          </OverlaysProvider>
        </Sidebar.Provider>
      </div>
    </div>
  );
}
