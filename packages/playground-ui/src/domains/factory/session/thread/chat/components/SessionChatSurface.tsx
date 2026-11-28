import type { ReactNode } from 'react';
import { chatColumnClass, composerColumnClass, reservedSpaceClass } from '../../workspace-viewer/layout';
import { ChatMessageBoundary } from '../context/ChatMessageBoundary';

import { useChatMessagePreparation } from '../context/useChatMessagePreparation';
import { useChatTranscript } from '../context/useChatTranscript';
import { ActivityLine } from './ActivityLine';
import { Composer } from './Composer';
import { Transcript } from './Transcript';
import type { TranscriptTail } from './Transcript';
import { TranscriptHistoryLoader } from './TranscriptHistoryLoader';
import { SessionSurface } from '@/domains/chat/transcript';
import { TranscriptAnnotations } from '@/ds/components/ai/annotations';

const activityTail: TranscriptTail = stretchLive => <ActivityLine stretchLive={stretchLive} />;

interface SessionChatSurfaceProps {
  secondaryBar?: ReactNode;
  emptyState: ReactNode;
  openingSession?: boolean;
  composerLabel: string;
  /** Leads the status row below the composer. */
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
  const conversationStarted = transcript.entries.some(entry => entry.kind !== 'notice');

  return (
    <SessionSurface
      busy={busy}
      preparing={threadPreparing || openingSession}
      tasks={transcript.tasks}
      loadMore={loadMore}
      composer={<Composer variant="inline" statusLead={composerStatus} />}
      composerLabel={composerLabel}
      secondaryBar={secondaryBar}
      contentOverlay={contentOverlay}
      className={chatColumnClass}
      viewportClassName={reservedSpaceClass.viewport}
      composerColumnClassName={composerColumnClass}
    >
      <TranscriptAnnotations />
      <ChatMessageBoundary showPreparation={false}>
        <TranscriptHistoryLoader />
        {!conversationStarted && emptyState}
        <Transcript tail={activityTail} />
      </ChatMessageBoundary>
    </SessionSurface>
  );
}
