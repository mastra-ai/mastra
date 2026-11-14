import { Button } from '@mastra/playground-ui/components/Button';
import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useMatch, useParams } from 'react-router';

import type { InstalledBoardInfo } from '../../../../api/types';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useUserSessionQuery, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { ChatPageLayout } from '../../chat/components/ChatPageLayout';
import { getUserSessionLabel } from '../../workspaces/services/sessionPresentation';
import { UserSessionSharing } from '../../workspaces/components/UserSessionSharing';
import { WorkspaceFilesSurface } from '../../workspace-viewer/components/WorkspaceFilesSurface';
import { WorkspaceFilesToggle } from '../../workspace-viewer/components/WorkspaceFilesToggle';
import { cardContextSessions, phaseContext } from '../boardItems';
import type { CardContextSession } from '../boardItems';
import { currentItemStage } from '../boardStages';
import { useSessionCard } from '../hooks/useSessionCard';
import type { WorkItem } from '../services/workItems';
import { CardStageBar } from './CardStageBar';
import { SessionContextMenu, cardSessionPath } from './SessionContextMenu';

interface OpenSessionContext {
  /** The context this session runs in, and its name. */
  context: string;
  label: string;
  /** Every session the card holds, one per context. */
  sessions: CardContextSession[];
  /** The session the card works in now, when that is another one. */
  workingSession?: CardContextSession;
}

/** The context this session runs in, and the session the card has moved on to when it works elsewhere. */
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

/**
 * Chat page frame for a factory thread: the session's title, the card's stage bar, and the session actions.
 * Each fact shows once: the sidebar names the session and leads back to the board, the panel names the card,
 * and the stage bar says where it stands. A card's session gets a title only when the card holds several,
 * as the label of the switcher between them.
 */
export function FactorySessionPage({ children }: { children: ReactNode }) {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId: string; threadId: string }>();
  // User threads carry the session id as `threadId` (see ChatSessionProvider).
  const isUserThread = Boolean(useMatch('/factories/:factoryId/user/threads/:threadId'));
  const userSessionId = sessionId ?? threadId;
  const sessionQuery = useUserSessionQuery(userSessionId);
  const workspaces = useWorkspacesQuery(factoryId);
  const factory = useFactoryQuery(factoryId).data;
  const { item: currentItem, sessionItems, board: boardEntry, loading: cardLoading } = useSessionCard();

  // Prefer the list row: PageTitle patches it with the generated title, the detail cache is not updated.
  const session = workspaces.data?.userSessions.find(entry => entry.sessionId === userSessionId) ?? sessionQuery.data;
  const openContext =
    currentItem && sessionId && threadId ? openSessionContext(currentItem, boardEntry, sessionId, threadId) : undefined;
  const switchable = openContext && openContext.sessions.length > 1 ? openContext : undefined;
  // "session" keeps the context apart from the stage the bar beside it names. Until the card is known, no
  // title: the session's own one would flash and go once the card turns out to hold this session.
  const title = currentItem
    ? switchable && `${switchable.label} session`
    : cardLoading
      ? undefined
      : session && isUserThread
        ? getUserSessionLabel(session)
        : session?.title?.trim();

  return (
    <ChatPageLayout
      title={title}
      titleMenu={
        switchable && factoryId && sessionId ? (
          <SessionContextMenu factoryId={factoryId} sessions={switchable.sessions} openSessionId={sessionId} />
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
      headerActions={
        <>
          {openContext?.workingSession && factoryId ? (
            <Button
              variant="ghost"
              size="sm"
              render={<Link to={cardSessionPath(factoryId, openContext.workingSession)} />}
            >
              <span className="truncate">Go to {openContext.workingSession.label} session</span>
              <ArrowRight aria-hidden />
            </Button>
          ) : null}
          {isUserThread && factoryId && session ? <UserSessionSharing factoryId={factoryId} session={session} /> : null}
          <WorkspaceFilesToggle />
        </>
      }
      aside={<WorkspaceFilesSurface />}
    >
      {children}
    </ChatPageLayout>
  );
}
