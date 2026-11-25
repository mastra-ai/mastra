import { SessionSurface } from '@mastra/playground-ui/domains/chat/transcript';
import type { ReactNode } from 'react';

import { chatColumnClass, composerColumnClass, reservedSpaceClass } from '../../workspace-viewer/layout';
import { ActivityLine } from './ActivityLine';
import { Composer } from './Composer';
import { Transcript } from './Transcript';
import type { TranscriptTail } from './Transcript';
import { ChatMessageBoundary } from '../context/ChatSessionProvider';
import { useChatMessagePreparation } from '../context/useChatMessagePreparation';
import { useChatTranscript } from '../context/useChatTranscript';

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

  return (
    <SessionSurface
      busy={busy}
      preparing={threadPreparing || openingSession}
      tasks={transcript.tasks}
      loadMore={loadMore}
      conversationStarted={transcript.entries.some(entry => entry.kind !== 'notice')}
      composer={<Composer variant="inline" statusLead={composerStatus} />}
      emptyState={emptyState}
      composerLabel={composerLabel}
      secondaryBar={secondaryBar}
      contentOverlay={contentOverlay}
      className={chatColumnClass}
      viewportClassName={reservedSpaceClass.viewport}
      composerColumnClassName={composerColumnClass}
    >
      <ChatMessageBoundary showPreparation={false}>
        <Transcript tail={activityTail} />
      </ChatMessageBoundary>
    </SessionSurface>
  );
}
