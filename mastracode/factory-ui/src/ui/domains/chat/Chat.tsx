import type { ReactNode } from 'react';
import { useMatch } from 'react-router';

import { ChatSessionConfigProvider } from './context/ChatSessionProvider';
import { ChatPermissionsProvider } from './context/ChatPermissionsProvider';

/**
 * Shared chat session providers, mounted once by `AppLayout` so the sidebar
 * and every routed page (chat or not) share the same session context.
 */
export function ChatSessionRouteProvider({ children }: { children: ReactNode }) {
  // `useParams` in a layout can't see descendant params, so match the thread
  // routes explicitly (params come back already decoded).
  const userDraftMatch = useMatch('/factories/:factoryId/user/new/:draftSessionId');
  const userThreadMatch = useMatch('/factories/:factoryId/user/threads/:threadId');
  const factoryThreadMatch = useMatch('/factories/:factoryId/workspaces/:sessionId/threads/:threadId');
  const userScoped = userDraftMatch !== null || userThreadMatch !== null;
  const threadId = userThreadMatch?.params.threadId ?? factoryThreadMatch?.params.threadId;

  return (
    <ChatSessionConfigProvider
      threadId={threadId}
      userScoped={userScoped}
      draftSessionId={userDraftMatch?.params.draftSessionId}
    >
      <ChatPermissionsProvider>{children}</ChatPermissionsProvider>
    </ChatSessionConfigProvider>
  );
}
