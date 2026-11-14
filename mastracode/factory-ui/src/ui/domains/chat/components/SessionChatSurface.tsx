import { TranscriptAnnotations } from '@mastra/playground-ui/components/ai/annotations';
import { ChatShell } from '@mastra/playground-ui/components/ChatShell';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode, RefObject } from 'react';

import { composerColumnClass } from '../../workspace-viewer/layout';
import { ActivityLine } from './ActivityLine';
import { BackgroundWorkPanel } from './background/BackgroundWorkPanel';
import { BackgroundWorkProvider } from './background/BackgroundWorkProvider';
import { ComposerPanel } from './ComposerPanel';
import { SessionPreparationOverlay } from './SessionPreparationOverlay';
import { TaskPanel } from './TaskPanel';
import { Transcript } from './Transcript';
import { TranscriptHistoryLoader } from './TranscriptHistoryLoader';
import { ChatMessageBoundary } from '../context/ChatSessionProvider';
import { useChatMessagePreparation } from '../context/useChatMessagePreparation';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';

interface SessionChatSurfaceProps {
  header?: ReactNode;
  secondaryBar?: ReactNode;
  emptyState: ReactNode;
  composerLabel: string;
  /** Leads the status row above the composer. */
  composerStatus?: ReactNode;
  className?: string;
  contentRef?: RefObject<HTMLDivElement | null>;
  contentOverlay?: ReactNode;
  stageSurface?: ReactNode;
}

export function SessionChatSurface({
  header,
  secondaryBar,
  emptyState,
  composerLabel,
  composerStatus,
  className,
  contentRef,
  contentOverlay,
  stageSurface,
}: SessionChatSurfaceProps) {
  const { busy, loadMore, transcript } = useChatTranscript();
  const { historyInitializing, preparing } = useChatMessagePreparation();
  const { baseUrl, sessionId, resourceReady } = useChatSessionContext();
  const canLoadMore = loadMore.hasMore && !loadMore.isLoading;

  return (
    <BackgroundWorkProvider
      baseUrl={baseUrl}
      sessionId={sessionId}
      threadId={transcript.threadId}
      entries={transcript.entries}
      enabled={resourceReady}
    >
      <ChatShell
        className={cn('chat-surface-enter flex-1', className)}
        scroller={{
          autoScroll: true,
          defaultScrollPosition: busy ? 'end' : 'last-anchor',
          preserveScrollOnPrepend: true,
          onReachStart: canLoadMore ? loadMore.load : undefined,
        }}
      >
        {header && <ChatShell.Bar>{header}</ChatShell.Bar>}
        {secondaryBar && <ChatShell.Bar>{secondaryBar}</ChatShell.Bar>}
        <ChatShell.Stage>
          <ChatShell.Viewport className="transition-[var(--workspace-files-transition,padding)]">
            <div ref={contentRef} className="relative flex min-h-full min-w-0 flex-1 flex-col">
              {contentOverlay}
              <ChatShell.Content
                role="region"
                aria-label="Conversation"
                aria-busy={preparing}
                className="relative gap-0 pt-6"
              >
                <SessionPreparationOverlay historyInitializing={historyInitializing} preparing={preparing} />
                <ChatShell.Transcript className="flex-1">
                  <TranscriptAnnotations />
                  <ChatMessageBoundary showPreparation={false}>
                    <TranscriptHistoryLoader />
                    {transcript.entries.length === 0 && emptyState}
                    <Transcript tail={stretchLive => <ActivityLine stretchLive={stretchLive} />} />
                  </ChatMessageBoundary>
                </ChatShell.Transcript>
              </ChatShell.Content>
              <ChatShell.Dock className="pb-[calc(var(--chat-gutter)+env(safe-area-inset-bottom))]">
                <ChatShell.ScrollButton aria-label="Jump to latest message" />
                <ChatShell.Column className={cn('gap-2', composerColumnClass)}>
                  <BackgroundWorkPanel />
                  <TaskPanel />
                  <div role="region" aria-label={composerLabel}>
                    <ComposerPanel statusLead={composerStatus} />
                  </div>
                </ChatShell.Column>
              </ChatShell.Dock>
            </div>
          </ChatShell.Viewport>
          {stageSurface}
        </ChatShell.Stage>
      </ChatShell>
    </BackgroundWorkProvider>
  );
}
