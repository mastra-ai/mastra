import { cardContextSessions, phaseContext } from '@mastra/factory/work-items/card-context-sessions';
import type { CardContextSession } from '@mastra/factory/work-items/card-context-sessions';
import { Button } from '@mastra/playground-ui/components/Button';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';
import { Link, useParams } from 'react-router';

import type { InstalledBoardInfo } from '../../../../api/types';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import type { SessionFrameSlots } from '../components/SessionRouteFrame';
import { UserSessionSharing } from '../../workspaces/components/UserSessionSharing';
import { threadPath } from '../../workspaces/services/factoryPaths';
import type { WorkspacePanelPage } from '../../workspace-viewer/context/WorkspacePanelContext';
import { useThreadWorkspacePath } from '../../workspace-viewer/hooks/useThreadWorkspacePath';
import { currentItemStage } from '../boardStages';
import type { WorkItem, WorkItemSessionRef } from '../services/workItems';
import { CardStageBar } from '../components/CardStageBar';
import { CardStageSummary } from '../components/CardStageSummary';
import { SessionContextMenu } from '../components/SessionContextMenu';
import { SessionPanelOverview } from '../components/SessionPanelOverview';
import { SessionPanelSubject } from '../components/SessionPanelSubject';
import { useOpenSession } from './useOpenSession';
import { useSessionCard } from './useSessionCard';

const SESSION_PANEL: WorkspacePanelPage = {
  subject: lead => <SessionPanelSubject lead={lead} />,
  overview: workspace => <SessionPanelOverview workspace={workspace} />,
};

interface OpenSessionContext {
  context: string;
  label: string;
  /** Every session the card holds, one per context. */
  sessions: CardContextSession<WorkItemSessionRef>[];
  workingSession?: CardContextSession<WorkItemSessionRef>;
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

function stageUnavailable(
  board: InstalledBoardInfo | undefined,
  boards: readonly InstalledBoardInfo[] | undefined,
  boardsFailed: boolean,
  factoryFailed: boolean,
): string | undefined {
  if (boardsFailed) return "Couldn't load the board";
  if (boards !== undefined && board === undefined) return 'Board not installed';
  if (factoryFailed) return "Couldn't load the factory";
  return undefined;
}

export function useThreadFrame(): SessionFrameSlots {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId: string; threadId: string }>();
  const { session, isUserThread, title: sessionTitle } = useOpenSession();
  const { workspacePath } = useThreadWorkspacePath();
  const factoryQuery = useFactoryQuery(factoryId);
  const factory = factoryQuery.data;
  const {
    item: currentItem,
    sessionItems,
    board: boardEntry,
    boards,
    loading: cardLoading,
    boardsFailed,
  } = useSessionCard();

  const openContext =
    currentItem && sessionId && threadId ? openSessionContext(currentItem, boardEntry, sessionId, threadId) : undefined;
  const switchable = openContext && openContext.sessions.length > 1 ? openContext : undefined;
  // No title until the card is known: the session's own would flash, then go.
  const title = currentItem ? switchable && `${switchable.label} session` : cardLoading ? undefined : sessionTitle;
  const stageNote = stageUnavailable(boardEntry, boards, boardsFailed, factoryQuery.isLoadingError);

  return {
    panel: workspacePath ? SESSION_PANEL : undefined,
    title,
    titleMenu:
      switchable && factoryId && sessionId ? (
        <>
          <SessionContextMenu factoryId={factoryId} sessions={switchable.sessions} openSessionId={sessionId} />
          {switchable.workingSession ? (
            <Button
              iconEnd={<IconArrowRight />}
              variant="ghost"
              size="sm"
              className="shrink-0"
              aria-label={`Go to ${switchable.workingSession.label} session`}
              render={<Link to={threadPath(factoryId, switchable.workingSession.ref)} />}
            >
              {switchable.workingSession.label}
            </Button>
          ) : null}
        </>
      ) : isUserThread && factoryId && session ? (
        <UserSessionSharing factoryId={factoryId} session={session} />
      ) : undefined,
    headerCenter:
      currentItem && boardEntry && factory ? (
        <CardStageBar
          item={currentItem}
          sessionItems={sessionItems}
          board={boardEntry}
          factory={factory}
          openContext={openContext?.context}
        />
      ) : currentItem && stageNote ? (
        <CardStageSummary item={currentItem} board={boardEntry} note={stageNote} />
      ) : undefined,
  };
}
