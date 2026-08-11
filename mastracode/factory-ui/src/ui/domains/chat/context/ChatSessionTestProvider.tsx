import type { ReactNode } from 'react';

import { ChatPermissionsProvider } from './ChatPermissionsProvider';
import { ChatSessionBoundary, ChatSessionConfigProvider } from './ChatSessionProvider';

export function ChatSessionTestProvider({
  children,
  threadId,
  userScoped = false,
  deferUntilMessagesReady = true,
}: {
  children: ReactNode;
  threadId?: string;
  userScoped?: boolean;
  deferUntilMessagesReady?: boolean;
}) {
  return (
    <ChatSessionConfigProvider threadId={threadId} userScoped={userScoped}>
      <ChatPermissionsProvider>
        <ChatSessionBoundary threadId={threadId} deferUntilMessagesReady={deferUntilMessagesReady}>
          {children}
        </ChatSessionBoundary>
      </ChatPermissionsProvider>
    </ChatSessionConfigProvider>
  );
}
