import { Button } from '@mastra/playground-ui/components/Button';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import type { InstalledBoardInfo } from '../../../../api/types';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { ChatPageLayout } from '../../chat/components/ChatPageLayout';
import { UserSessionSharing } from '../../workspaces/components/UserSessionSharing';
import { WorkspaceFilesToggle } from '../../workspace-viewer/components/WorkspaceFilesToggle';
import { useWorkspacePanelDockActions } from '../../workspace-viewer/hooks/useWorkspacePanelDockActions';
import { cardContextSessions, phaseContext } from '../boardItems';
import type { CardContextSession } from '../boardItems';
import { currentItemStage } from '../boardStages';
import { useSessionCard } from '../hooks/useSessionCard';
import { useOpenSession } from '../hooks/useOpenSession';
import type { WorkItem } from '../services/workItems';
import { CardStageBar } from './CardStageBar';
import { SessionContextMenu, cardSessionPath } from './SessionContextMenu';
import { ThreadSubscriptionsRefresh } from './ThreadSubscriptionsRefresh';

interface OpenSessionContext {
  /** The context this session runs in, and its name. */
  context: string;
  label: string;
  /** Every session the card holds, one per context. */
  sessions: CardContextSession[];
  /** The session the card works in now, when that is another one. */
  workingSession?: CardContextSession;
}

function openSessionContext(
  item: WorkItem,
  board: InstalledBoardInfo | undefined,
  sessionId: string,
  threadId: string,
): OpenSessionContext | undefined {
  const stage = currentItemStage(item, board);
  if (stage === undefined) return undefined;
  const phases = board?.phases;
  const sessions = cardContextSessions(item, phases, stage);
  const entry = sessions.find(
    candidate => candidate.ref.sessionId === sessionId && candidate.ref.threadId === threadId,
  );
  if (!entry) return undefined;
  const open = { context: entry.context, label: entry.label, sessions };
  const currentPhase = phases?.find(phase => phase.id === stage);
  // A context no phase runs in (self-review's `review`, legacy `plan`) is not
  // one the card moves out of, so the card being elsewhere says nothing.
  const phaseRunsHere = phases?.some(phase => phaseContext(phase) === entry.context);
  if (entry.current || !phaseRunsHere || !currentPhase || phaseContext(currentPhase) === undefined) return open;
  return { ...open, workingSession: sessions.find(candidate => candidate.current) };
}

/** A card's session gets a title only when the card holds several, as the label of the switcher between them. */
export function FactorySessionPage({ children }: { children: ReactNode }) {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId: string; threadId: string }>();
  const { session, isUserThread, title: sessionTitle } = useOpenSession();
  const factory = useFactoryQuery(factoryId).data;
  const { item: currentItem, sessionItems, board: boardEntry, loading: cardLoading } = useSessionCard();
  const dockActions = useWorkspacePanelDockActions();

  const openContext =
    currentItem && sessionId && threadId ? openSessionContext(currentItem, boardEntry, sessionId, threadId) : undefined;
  const switchable = openContext && openContext.sessions.length > 1 ? openContext : undefined;
  // No title until the card is known: the session's own would flash, then go.
  const title = currentItem ? switchable && `${switchable.label} session` : cardLoading ? undefined : sessionTitle;

  return (
    <ChatPageLayout
      title={title}
      titleMenu={
        switchable && factoryId && sessionId ? (
          <>
            <SessionContextMenu factoryId={factoryId} sessions={switchable.sessions} openSessionId={sessionId} />
            {switchable.workingSession ? (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                aria-label={`Go to ${switchable.workingSession.label} session`}
                render={<Link to={cardSessionPath(factoryId, switchable.workingSession)} />}
              >
                {switchable.workingSession.label}
                <IconArrowRight aria-hidden />
              </Button>
            ) : null}
          </>
        ) : isUserThread && factoryId && session ? (
          <UserSessionSharing factoryId={factoryId} session={session} />
        ) : undefined
      }
      headerCenter={
        currentItem && boardEntry && factory ? (
          <CardStageBar
            item={currentItem}
            sessionItems={sessionItems}
            board={boardEntry}
            factory={factory}
            openContext={openContext?.context}
          />
        ) : undefined
      }
      headerActions={<WorkspaceFilesToggle />}
      dockActions={dockActions}
    >
      <ThreadSubscriptionsRefresh />
      {children}
    </ChatPageLayout>
  );
}
