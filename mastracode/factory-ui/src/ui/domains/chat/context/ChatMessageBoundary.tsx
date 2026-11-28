import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';
import { useContext } from 'react';

import { SkeletonRows } from '@mastra/playground-ui/domains/factory';
import { TranscriptLoading } from '../components/TranscriptLoading';
import { isSessionNotFound } from '../services/sessionErrors';
import { ChatThreadMessagesContext } from './ChatThreadMessagesContext';
import type { ChatThreadMessagesApi } from './ChatThreadMessagesContext';
import { useChatMessagePreparation } from './useChatMessagePreparation';
import { useChatSessionContext } from './useChatSessionContext';

/** Limits delayed thread-history feedback to the transcript content region. */
export function ChatMessageBoundary({
  children,
  showPreparation = true,
}: {
  children: ReactNode;
  showPreparation?: boolean;
}) {
  const value = useContext(ChatThreadMessagesContext);
  if (!value) throw new Error('ChatMessageBoundary must be used within a ChatSessionBoundary');
  const { sessionError } = useChatSessionContext();
  const { preparing } = useChatMessagePreparation();

  if (sessionError) return <ChatMessageFeedback error={sessionError} />;

  if (preparing) {
    return showPreparation ? <TranscriptLoading /> : null;
  }

  if (value.threadId && value.error) {
    return <ChatMessageFallback {...value} />;
  }

  return <>{children}</>;
}

function ChatMessageFeedback({ error }: { error: Error }) {
  const { retrySession } = useChatSessionContext();
  const notFound = isSessionNotFound(error);
  return (
    <div className="flex flex-col items-stretch gap-4">
      <Notice variant="destructive">
        {notFound
          ? 'This session was not found or is private to another user.'
          : `Failed to prepare the workspace: ${error.message}`}
      </Notice>
      {retrySession && (
        <div>
          <Button variant="default" onClick={retrySession}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

function ChatMessageFallback({ threadId, isPending, error }: ChatThreadMessagesApi) {
  if (threadId && isPending) {
    return (
      <div className="flex flex-col gap-4">
        <SkeletonRows label="Loading messages" rows={6} />
      </div>
    );
  }

  if (threadId && error) {
    const errorMessage = error instanceof Error ? error.message : undefined;
    return (
      <Notice variant="destructive">
        {errorMessage ? `Failed to load messages: ${errorMessage}` : 'Failed to load messages.'}
      </Notice>
    );
  }

  return null;
}
