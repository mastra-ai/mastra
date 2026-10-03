import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { focusRingInset } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { EllipsisVertical } from 'lucide-react';
import type { ReactElement } from 'react';
import { useParams } from 'react-router';

import { boardCardState } from '../boardCardState';
import { nextBoardPhase, primaryCardMove, proposedCardRun, movingCardStatus } from '../workItemCardPresentation';
import { setDragPayload } from '../boardDrag';
import type { DragPayload } from '../boardDrag';
import { itemThreadSession } from '../boardItems';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { itemBoard } from '../boardStages';
import {
  awaitsTriageDecision,
  cardActions,
  cardMoves,
  cardPrimaryAction,
  resumeStage,
  retryButton,
  sessionLink,
} from '../cardPrimaryAction';
import { useCardMorph } from '../hooks/useCardMorph';
import type { AuditEventPage } from '../services/audit';
import type { FactoryDecisionSummary } from '../services/decisions';
import { relationshipPath } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import type { BoardLayout } from '../boardLayout';
import type { BoardStageId } from '../stages';
import { workItemActivity } from '../workItemActivity';
import { ActivityWick } from '@mastra/playground-ui/components/Activity';
import type { SessionRowStatus } from '../../workspaces/services/sessionStatus';
import { CardDetailsHint, REVEAL_ON_CARD_HOVER } from './BoardCardParts';
import { RelatedWorkItemLink } from './RelatedWorkItemLink';
import { WorkItemCardRows } from './WorkItemCardRows';
import { WorkItemDetailsPanel } from './WorkItemDetailsPanel';
import type { WorkItemMenuProps } from './WorkItemMenuItems';
import { WorkItemMenuItems } from './WorkItemMenuItems';
import { WorkItemListRow } from './WorkItemListRow';

export function WorkItemCard({
  item,
  deepLinkRef,
  deepLinkCommentId,
  highlighted,
  columnStage,
  relatedItems,
  projectRepositoryId,
  activityPage,
  preparing,
  evaluatingStage,
  transitionReason,
  decision,
  proposal,
  approvingDecisionId,
  retryingDecisionId,
  onApproveProposal,
  onDismissProposal,
  onRetryDecision,
  sessionStatus,
  onCreateSession,
  onMove,
  onRemove,
  layout,
}: {
  item: WorkItem;
  deepLinkRef: (element: HTMLElement | null) => void;
  deepLinkCommentId?: string;
  highlighted: boolean;
  columnStage: BoardStageId;
  relatedItems: WorkItem[];
  projectRepositoryId: string;
  activityPage?: AuditEventPage;
  preparing?: string;
  evaluatingStage?: string;
  transitionReason?: string;
  decision?: FactoryDecisionSummary;
  proposal?: FactoryDecisionSummary;
  approvingDecisionId?: string;
  retryingDecisionId?: string;
  onApproveProposal: (decisionId: string) => void;
  onDismissProposal: (decisionId: string) => void;
  onRetryDecision: (decisionId: string) => void;
  sessionStatus?: SessionRowStatus;
  onCreateSession: (spec: { branch: string; threadTitle: string }) => void;
  onMove: (toStage: string) => void;
  onRemove: () => void;
  layout: BoardLayout;
}) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  const morph = useCardMorph({ openFor: deepLinkCommentId });
  const catalog = useBoardCatalog(item.githubProjectId);
  const boardId = itemBoard(item);
  const custom = boardId !== 'work' && boardId !== 'review';
  const definition = catalog.data?.find(board => board.id === boardId);

  const startingLabel = proposal !== undefined && approvingDecisionId === proposal.id ? 'Starting…' : preparing;
  const sessions = item.sessions;
  const moves = cardMoves(item, columnStage);
  const primaryMove = primaryCardMove(moves, columnStage, sessions);
  const threadSession = itemThreadSession(sessions);
  const nextPhase = nextBoardPhase(definition, columnStage);
  const sessionHref =
    threadSession === undefined
      ? undefined
      : `/factories/${factoryId}/workspaces/${threadSession.sessionId}/threads/${threadSession.threadId}`;
  const proposedRun = proposedCardRun(proposal, custom, definition, moves, primaryMove);
  const proposedRunLabel = proposedRun?.label;

  const activity = workItemActivity(item, activityPage);
  const state = boardCardState({
    proposal: proposedRun,
    moving: movingCardStatus(evaluatingStage, definition, item),
    preparing: startingLabel,
    retryRequested: decision !== undefined && retryingDecisionId === decision.id,
    decision,
    transitionReason,
    sessionStatus,
    heldAs: awaitsTriageDecision(item, columnStage) ? (item.triageType ?? undefined) : undefined,
  });
  const { status, owner, wick } = state;
  const lockedByYou = owner.kind === 'you';
  const busy = lockedByYou || owner.kind === 'automation';
  const dragPayload: DragPayload | undefined = lockedByYou
    ? undefined
    : { kind: 'work-item', id: item.id, fromStage: columnStage, ownerKind: owner.kind };
  const retryDecisionId = status.kind === 'error' ? status.retryDecisionId : undefined;
  const primaryAction = cardPrimaryAction({
    item,
    columnStage,
    move: primaryMove,
    resumeStage: custom ? undefined : resumeStage(columnStage, sessions),
    nextPhase: custom ? nextPhase : undefined,
    waiting: status.kind === 'waiting' ? status : undefined,
    hasSession: threadSession !== undefined,
    onApproveProposal,
    onCreateSession,
    onMove,
  });

  const menu: WorkItemMenuProps = {
    item,
    columnStage,
    moves,
    proposal,
    proposedRunLabel,
    approvingDecisionId,
    owner,
    onApproveProposal,
    onDismissProposal,
    onMove,
    onRemove,
  };
  const panelMenu: WorkItemMenuProps = {
    ...menu,
    onApproveProposal: decisionId => {
      morph.closeDetails();
      onApproveProposal(decisionId);
    },
    onMove: toStage => {
      morph.closeDetails();
      onMove(toStage);
    },
    onRemove: () => {
      morph.closeDetails();
      onRemove();
    },
  };

  const relatedLink = (related: WorkItem): ReactElement => {
    const relatedSession = itemThreadSession(related.sessions);

    if (relatedSession !== undefined) {
      return (
        <RelatedWorkItemLink
          key={related.id}
          item={related}
          href={`/factories/${factoryId}/workspaces/${relatedSession.sessionId}/threads/${relatedSession.threadId}`}
          kind="session"
        />
      );
    }

    if (related.url !== null) {
      return <RelatedWorkItemLink key={related.id} item={related} href={related.url} kind="external" />;
    }

    return (
      <RelatedWorkItemLink key={related.id} item={related} href={relationshipPath(related, factoryId)} kind="board" />
    );
  };
  const actions = cardActions({
    state,
    session: sessionLink(sessionHref),
    retry: retryButton({ decisionId: retryDecisionId, onRetry: onRetryDecision }),
    run: primaryAction,
  });

  const detailsPanel = (
    <WorkItemDetailsPanel
      item={item}
      columnStage={columnStage}
      projectRepositoryId={projectRepositoryId}
      activityPage={activityPage}
      morph={morph}
      relatedLinks={relatedItems.map(relatedLink)}
      status={status}
      actions={actions}
      menu={<WorkItemMenuItems {...panelMenu} />}
    />
  );

  if (layout === 'list') {
    return (
      <>
        <WorkItemListRow
          item={item}
          morph={morph}
          deepLinkRef={deepLinkRef}
          highlighted={highlighted}
          locked={lockedByYou}
          busy={busy}
          dragPayload={dragPayload}
          activity={activity}
          actors={activityPage?.actors ?? {}}
          status={status}
          actions={actions}
          menu={<WorkItemMenuItems {...menu} />}
        />
        {detailsPanel}
      </>
    );
  }

  return (
    <>
      <article
        ref={morph.cardRef}
        draggable={dragPayload !== undefined}
        aria-label={item.title}
        aria-busy={busy || undefined}
        data-testid="work-item-card"
        data-related={relatedItems.length > 0 ? 'true' : undefined}
        data-highlighted={highlighted || undefined}
        onDragStart={event => {
          if (dragPayload) setDragPayload(event, dragPayload);
        }}
        className={cn(
          'group relative flex min-h-36 flex-col gap-3 rounded-card border border-border/50 bg-fill-subtle p-2 outline-none transition-colors hover:bg-fill-hover',
          wick ? 'border-transparent' : '[content-visibility:auto] [contain-intrinsic-size:auto_9rem]',
          lockedByYou ? 'cursor-wait opacity-70' : 'cursor-grab active:cursor-grabbing',
          highlighted && 'border-warning-edge bg-warning-subtle ring-1 ring-warning-edge',
        )}
      >
        {wick && <ActivityWick status={wick} />}
        <button
          ref={deepLinkRef}
          type="button"
          draggable={false}
          aria-label={`Details for ${item.title}`}
          aria-expanded={morph.open}
          className={`rounded-card absolute inset-0 cursor-pointer ${focusRingInset}`}
          onClick={morph.openDetails}
        />
        <WorkItemCardRows
          item={item}
          columnStage={columnStage}
          relatedLinks={relatedItems.map(relatedLink)}
          activity={activity}
          actors={activityPage?.actors ?? {}}
          status={status}
          actions={actions}
          open={false}
          controls={
            <>
              <CardDetailsHint onOpen={morph.openDetails} />
              <DropdownMenu>
                <DropdownMenu.Trigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={lockedByYou}
                      aria-label={`Actions for ${item.title}`}
                      className={REVEAL_ON_CARD_HOVER}
                    >
                      <EllipsisVertical size={13} aria-hidden />
                    </Button>
                  }
                />
                <DropdownMenu.Content align="end" className="min-w-44">
                  <WorkItemMenuItems {...menu} />
                </DropdownMenu.Content>
              </DropdownMenu>
            </>
          }
        />
      </article>
      {detailsPanel}
    </>
  );
}
