import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { cn } from '@mastra/playground-ui/utils/cn';
import { EllipsisVertical } from 'lucide-react';
import type { ReactElement } from 'react';
import { useParams } from 'react-router';

import { boardCardStatus } from '../boardCardStatus';
import { setDragPayload } from '../boardDrag';
import { itemThreadSession } from '../boardItems';
import { itemStageLabel } from '../boardStages';
import {
  awaitsTriageDecision,
  cardActions,
  cardMoves,
  cardPrimaryAction,
  resumeStage,
  retryButton,
  runButton,
  sessionLink,
} from '../cardPrimaryAction';
import { useCardMorph } from '../hooks/useCardMorph';
import type { AuditEventPage } from '../services/audit';
import type { FactoryDecisionSummary } from '../services/decisions';
import { relationshipPath } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';
import { workItemActivity } from '../workItemActivity';
import { SessionActivityWick } from '../../workspaces/components/SessionActivity';
import type { SessionRowStatus } from '../../workspaces/services/sessionStatus';
import { CardDetailsHint, REVEAL_ON_CARD_HOVER } from './BoardCardParts';
import { RelatedWorkItemLink } from './RelatedWorkItemLink';
import { WorkItemCardRows } from './WorkItemCardRows';
import { WorkItemDetailsPanel } from './WorkItemDetailsPanel';
import type { WorkItemMenuProps } from './WorkItemMenuItems';
import { WorkItemMenuItems } from './WorkItemMenuItems';
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
}: {
  item: WorkItem;
  // Hands the card's own control to the board, which scrolls to it and focuses it when the card is deeplinked.
  deepLinkRef: (element: HTMLElement | null) => void;
  /** Comment deep link (`?item&comment`): holds the details popover open so the feed is reachable. */
  deepLinkCommentId?: string;
  highlighted: boolean;
  columnStage: BoardStageId;
  /** Cards linked to this one, resolved once for the whole board. */
  relatedItems: WorkItem[];
  /** Repository id resolving GitHub descriptions in the detail panel. */
  projectRepositoryId: string;
  activityPage?: AuditEventPage;
  /** Status text while a session start is resolving, before its mutation starts. */
  preparing?: string;
  /** Destination stage of an in-flight transition; undefined = not moving. */
  evaluatingStage?: string;
  transitionReason?: string;
  decision?: FactoryDecisionSummary;
  /** Run a rule wants to start on this card, waiting for someone to release it. */
  proposal?: FactoryDecisionSummary;
  approvingDecisionId?: string;
  retryingDecisionId?: string;
  onApproveProposal: (decisionId: string) => void;
  onDismissProposal: (decisionId: string) => void;
  onRetryDecision: (decisionId: string) => void;
  /** Live status of the card's bound sessions, resolved once for the whole board. */
  sessionStatus?: SessionRowStatus;
  /** Fallback when the card offers no lane: open a session on it (no run). */
  onCreateSession: (spec: { branch: string; threadTitle: string }) => void;
  onMove: (toStage: string, options?: { preapprovePlans?: boolean }) => void;
  onRemove: () => void;
}) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  const morph = useCardMorph({ openFor: deepLinkCommentId });

  const evaluating = evaluatingStage !== undefined;
  const busyLabel = proposal !== undefined && approvingDecisionId === proposal.id ? 'Starting…' : preparing;
  const sessions = item.sessions;
  const moves = cardMoves(item, columnStage);
  // The lane's own move first: clicking the button of the column a card sits in re-runs that lane.
  // Then the first lane whose seat is still free, so a card never leads with a run it has already had.
  const primaryMove =
    moves.find(move => move.stage === columnStage) ?? moves.find(move => !(move.role in sessions)) ?? moves[0];
  const threadSession = itemThreadSession(sessions);
  const wickStatus = threadSession !== undefined ? sessionStatus : undefined;
  const sessionHref =
    threadSession === undefined
      ? undefined
      : `/factories/${factoryId}/workspaces/${threadSession.sessionId}/threads/${threadSession.threadId}`;
  const proposedRunLabel =
    proposal === undefined
      ? undefined
      : (moves.find(move => move.role === proposal.role)?.label ?? primaryMove?.label ?? 'Start run');

  const activity = workItemActivity(item, activityPage);
  const status = boardCardStatus({
    proposal:
      proposal === undefined || proposedRunLabel === undefined
        ? undefined
        : { label: proposedRunLabel, decisionId: proposal.id },
    moving:
      evaluatingStage === undefined
        ? undefined
        : { stage: evaluatingStage, label: itemStageLabel(item, evaluatingStage) },
    preparing: busyLabel,
    decision,
    transitionReason,
    sessionStatus,
    heldAs: awaitsTriageDecision(item, columnStage) ? (item.triageType ?? undefined) : undefined,
  });
  const retryDecisionId = status.kind === 'error' ? status.retryDecisionId : undefined;
  const primaryAction = cardPrimaryAction({
    item,
    columnStage,
    move: primaryMove,
    resumeStage: resumeStage(columnStage, sessions),
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
    onApproveProposal,
    onDismissProposal,
    onMove,
    onRemove,
  };

  // Acting collapses the panel first, so the result lands on the card it came from.
  // Dismissing a suggested run is the one entry that leaves it open.
  const panelMenu: WorkItemMenuProps = {
    ...menu,
    onApproveProposal: decisionId => {
      morph.closeDetails();
      onApproveProposal(decisionId);
    },
    onMove: (toStage, options) => {
      morph.closeDetails();
      onMove(toStage, options);
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

  // A held card's decision, like a parked suggestion, is the person's to
  // release, so it stays on the card beside a finished triage session.
  const actions = cardActions({
    running: wickStatus !== undefined,
    waiting: status.kind === 'waiting' || status.kind === 'held',
    session: sessionLink(sessionHref),
    retry: retryButton({ decisionId: retryDecisionId, retryingDecisionId, onRetry: onRetryDecision }),
    run: runButton({
      action: primaryAction,
      pending: busyLabel !== undefined,
      suggestion: status.kind === 'waiting' ? status.label : undefined,
    }),
  });

  return (
    <>
      <article
        ref={morph.cardRef}
        draggable={!evaluating}
        aria-label={item.title}
        aria-busy={evaluating || busyLabel !== undefined || undefined}
        data-testid="work-item-card"
        data-related={relatedItems.length > 0 ? 'true' : undefined}
        data-highlighted={highlighted || undefined}
        onDragStart={event => {
          if (!evaluating) setDragPayload(event, { kind: 'work-item', id: item.id, fromStage: columnStage });
        }}
        className={cn(
          'group relative flex min-h-36 flex-col gap-3 rounded-3xl border border-border1/50 bg-neutral6/5 p-2.5 outline-none transition-colors hover:bg-surface3',
          // `content-visibility` clips at the padding box, which the wick's ring has to reach past.
          wickStatus ? 'border-transparent' : '[content-visibility:auto] [contain-intrinsic-size:auto_9rem]',
          evaluating ? 'cursor-wait' : 'cursor-grab active:cursor-grabbing',
          busyLabel !== undefined && 'opacity-70',
          highlighted && 'border-warning1/40 bg-warning1/5 ring-1 ring-warning1/30',
        )}
      >
        {wickStatus && <SessionActivityWick status={wickStatus} />}
        <button
          ref={deepLinkRef}
          type="button"
          draggable={false}
          aria-label={`Details for ${item.title}`}
          aria-expanded={morph.open}
          className="focus-visible:outline-accent1 absolute inset-0 cursor-pointer rounded-3xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
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
              <CardDetailsHint />
              <DropdownMenu>
                <DropdownMenu.Trigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={evaluating}
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
    </>
  );
}
