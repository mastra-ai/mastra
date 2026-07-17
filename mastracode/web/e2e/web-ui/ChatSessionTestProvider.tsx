import type { ReactNode } from 'react';

import { ChatPermissionsProvider } from '../../src/web/ui/domains/chat/context/ChatPermissionsProvider';
import {
  ChatSessionBoundary,
  ChatSessionConfigProvider,
} from '../../src/web/ui/domains/chat/context/ChatSessionProvider';

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
