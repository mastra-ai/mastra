import type { ReactNode } from 'react';

import { ChatPermissionsProvider } from './context/ChatPermissionsProvider';
import { ChatSessionConfigProvider } from './context/ChatSessionProvider';
import { RouterSessionHost } from './context/RouterSessionHost';
import { useSessionHost } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/SessionHostContext';

/**
 * Shared chat session providers, mounted once by `AppLayout` so the sidebar
 * and every routed page (chat or not) share the same session context.
 */
export function ChatSessionRouteProvider({ children }: { children: ReactNode }) {
  return (
    <RouterSessionHost>
      <RoutedChatSession>{children}</RoutedChatSession>
    </RouterSessionHost>
  );
}

function RoutedChatSession({ children }: { children: ReactNode }) {
  const { routeKind, threadId, draftSessionId } = useSessionHost();
  return (
    <ChatSessionConfigProvider
      threadId={threadId}
      userScoped={routeKind === 'user-draft' || routeKind === 'user-thread'}
      draftSessionId={draftSessionId}
    >
      <ChatPermissionsProvider>{children}</ChatPermissionsProvider>
    </ChatSessionConfigProvider>
  );
}
