import { AppShell } from '@mastra/playground-ui/new/layout/app-shell';
import { SidebarNew } from '@mastra/playground-ui/new/sidebar';
import { frameSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Outlet } from 'react-router';

import { ChatHeader } from '../domains/chat/components/ChatHeader';
import { ChatOverlays } from '../domains/chat/components/ChatOverlays';
import { ChatSessionRouteProvider } from '../domains/chat/components/ChatSessionRouteProvider';
import { OverlaysProvider } from '../lib/overlays';
import { Sidebar } from '../Sidebar';

/**
 * Persistent app chrome for every `/factories/:factoryId/**` route: the sidebar
 * provider, route-bound chat session providers, global overlays (search,
 * shortcuts), the sidebar, the mobile/collapsed header, and the framed card
 * the pages render into. Mounted once in the router so navigating between
 * pages never remounts the sidebar (same structure as Studio's `Layout`).
 */
export function FactoryAppFrame() {
  return (
    <SidebarNew.Provider storageKey="mastracode-web" collapsedWidth={0}>
      <ChatSessionRouteProvider>
        <OverlaysProvider>
          <AppShell sidebar={<Sidebar />} mobileHeader={<ChatHeader />}>
            <div
              data-slot="factory-card"
              className={cn(
                'relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-studio-frame',
                frameSurfaceStyle,
              )}
            >
              <Outlet />
            </div>
          </AppShell>
          <ChatOverlays />
        </OverlaysProvider>
      </ChatSessionRouteProvider>
    </SidebarNew.Provider>
  );
}
