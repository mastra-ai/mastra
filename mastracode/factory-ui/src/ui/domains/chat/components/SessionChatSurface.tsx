import { TranscriptAnnotations } from '@mastra/playground-ui/components/ai/annotations';
import { ChatShell } from '@mastra/playground-ui/components/ChatShell';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

import { chatColumnClass, composerColumnClass, reservedSpaceClass } from '../../workspace-viewer/layout';
import { ActivityLine } from './ActivityLine';
import { chatHeaderRoomPx } from './chatPageHeader';
import { ComposerPanel } from './ComposerPanel';
import { SessionPreparationOverlay } from './SessionPreparationOverlay';
import { TaskPanel } from './TaskPanel';
import { Transcript } from './Transcript';
import type { TranscriptTail } from './Transcript';
import { TranscriptHistoryLoader } from './TranscriptHistoryLoader';
import { ChatMessageBoundary } from '../context/ChatSessionProvider';
import { useChatMessagePreparation } from '../context/useChatMessagePreparation';
import { useChatTranscript } from '../context/useChatTranscript';

import './chat-enter.css';

const PREVIOUS_TURN_PEEK_PX = 64;
const activityTail: TranscriptTail = stretchLive => <ActivityLine stretchLive={stretchLive} />;

interface SessionChatSurfaceProps {
  secondaryBar?: ReactNode;
  emptyState: ReactNode;
  openingSession?: boolean;
  composerLabel: string;
  /** Leads the status row above the composer. */
  composerStatus?: ReactNode;
  contentOverlay?: ReactNode;
}

export function SessionChatSurface({
  secondaryBar,
  emptyState,
  openingSession = false,
  composerLabel,
  composerStatus,
  contentOverlay,
}: SessionChatSurfaceProps) {
  const { busy, loadMore, transcript } = useChatTranscript();
  const { preparing: threadPreparing } = useChatMessagePreparation();
  const preparing = threadPreparing || openingSession;
  const canLoadMore = loadMore.hasMore && !loadMore.isLoading;
  const conversationStarted = transcript.entries.some(entry => entry.kind !== 'notice');

  return (
    <ChatShell
      className={cn('chat-surface-enter flex-1 [--chat-gutter:0.25rem]', chatColumnClass)}
      scroller={{
        autoScroll: true,
        defaultScrollPosition: busy ? 'end' : 'last-anchor',
        preserveScrollOnPrepend: true,
        onReachStart: canLoadMore ? loadMore.load : undefined,
        scrollPreviousItemPeek: chatHeaderRoomPx + PREVIOUS_TURN_PEEK_PX,
      }}
    >
      {secondaryBar && <ChatShell.Bar className="not-empty:mt-(--chat-header-room)">{secondaryBar}</ChatShell.Bar>}
      <ChatShell.Stage>
        <ChatShell.Viewport className={reservedSpaceClass.viewport}>
          <div className="relative flex min-h-full min-w-0 flex-1 flex-col">
            {/* A fixed slot: mounting the rail straight into this box would restyle the whole transcript beside it. */}
            <div className="contents">{contentOverlay}</div>
            <ChatShell.Content
              role="region"
              aria-label="Conversation"
              aria-busy={preparing}
              // A sibling selector, not `:has()`: under `:has()` every new message would restyle the whole transcript.
              className="relative gap-0 pt-[calc(var(--chat-header-room,0px)+1.5rem)] [[data-slot=chat-shell-bar]:not(:empty)~[data-slot=message-scroller]_&]:pt-6"
            >
              <SessionPreparationOverlay preparing={preparing} />
              <ChatShell.Transcript className="flex-1">
                <TranscriptAnnotations />
                <ChatMessageBoundary showPreparation={false}>
                  <TranscriptHistoryLoader />
                  {!conversationStarted && emptyState}
                  <Transcript tail={activityTail} />
                </ChatMessageBoundary>
              </ChatShell.Transcript>
            </ChatShell.Content>
            <ChatShell.Dock className="pb-[calc(var(--chat-gutter)+env(safe-area-inset-bottom))]">
              <ChatShell.ScrollButton aria-label="Jump to latest message" />
              <ChatShell.Column className={cn('gap-2', composerColumnClass)}>
                <TaskPanel />
                <div role="region" aria-label={composerLabel}>
                  <ComposerPanel statusLead={composerStatus} />
                </div>
              </ChatShell.Column>
            </ChatShell.Dock>
          </div>
        </ChatShell.Viewport>
      </ChatShell.Stage>
    </ChatShell>
  );
}
