import { ChatShell } from '@mastra/playground-ui/components/ChatShell';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode, RefObject } from 'react';

import { composerColumnClass } from '../../workspace-viewer/layout';
import { ActivityLine } from './ActivityLine';
import { ComposerPanel } from './ComposerPanel';
import { SessionPreparationOverlay } from './SessionPreparationOverlay';
import { TaskPanel } from './TaskPanel';
import { Transcript } from './Transcript';
import { TranscriptHistoryLoader } from './TranscriptHistoryLoader';
import type { ChatConnectionApi } from '../context/ChatConnectionContext';
import { ChatMessageBoundary } from '../context/ChatSessionProvider';
import { useChatConnection } from '../context/useChatConnection';
import { useChatMessagePreparation } from '../context/useChatMessagePreparation';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';

interface SessionChatSurfaceProps {
  header: ReactNode;
  secondaryBar?: ReactNode;
  emptyState: ReactNode;
  composerLabel: string;
  className?: string;
  contentRef?: RefObject<HTMLDivElement | null>;
  contentOverlay?: ReactNode;
  stageSurface?: ReactNode;
}

function runStateKnown(connection: ChatConnectionApi, resourceReady: boolean): boolean {
  const draftNeverConnects = !resourceReady;
  return draftNeverConnects || connection.state !== undefined || connection.status === 'error';
}

export function SessionChatSurface({
  header,
  secondaryBar,
  emptyState,
  composerLabel,
  className,
  contentRef,
  contentOverlay,
  stageSurface,
}: SessionChatSurfaceProps) {
  const { busy, loadMore, transcript } = useChatTranscript();
  const { historyInitializing, preparing } = useChatMessagePreparation();
  const connection = useChatConnection();
  const { resourceReady } = useChatSessionContext();
  const showEmptyState = transcript.entries.length === 0 && !busy && runStateKnown(connection, resourceReady);
  const canLoadMore = loadMore.hasMore && !loadMore.isLoading;

  return (
    <ChatShell
      className={cn('chat-surface-enter flex-1', className)}
      scroller={{
        autoScroll: true,
        defaultScrollPosition: busy ? 'end' : 'last-anchor',
        preserveScrollOnPrepend: true,
        onReachStart: canLoadMore ? loadMore.load : undefined,
      }}
    >
      <ChatShell.Bar>{header}</ChatShell.Bar>
      {secondaryBar && <ChatShell.Bar>{secondaryBar}</ChatShell.Bar>}
      <ChatShell.Stage>
        <ChatShell.Viewport>
          <SessionPreparationOverlay historyInitializing={historyInitializing} preparing={preparing} />
          <div ref={contentRef} className="relative flex min-h-full min-w-0 flex-1 flex-col">
            {contentOverlay}
            <ChatShell.Content className="gap-0 pt-6">
              <ChatShell.Column className="flex-1">
                <ChatMessageBoundary showPreparation={false}>
                  <TranscriptHistoryLoader />
                  {showEmptyState && emptyState}
                  <Transcript tail={<ActivityLine />} />
                </ChatMessageBoundary>
              </ChatShell.Column>
            </ChatShell.Content>
            <ChatShell.Dock>
              <ChatShell.ScrollButton aria-label="Jump to latest message" />
              <ChatShell.Column className={cn('gap-2', composerColumnClass)}>
                <TaskPanel />
                <div role="region" aria-label={composerLabel}>
                  <ComposerPanel />
                </div>
              </ChatShell.Column>
            </ChatShell.Dock>
          </div>
        </ChatShell.Viewport>
        {stageSurface}
      </ChatShell.Stage>
    </ChatShell>
  );
}
