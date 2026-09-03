import { FACTORY_ROLE_STAGES } from '@mastra/factory/rules/types';
import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { cn } from '@mastra/playground-ui/utils/cn';
import { EllipsisVertical } from 'lucide-react';
import type { ReactElement } from 'react';
import { useParams } from 'react-router';

import type { FactoryRunPhase } from '../../../../hooks/useStartFactoryRun';
import { boardCardStatus } from '../boardCardStatus';
import { setDragPayload } from '../boardDrag';
import { itemThreadSession, pullRequestStatusForItem } from '../boardItems';
import { itemRunSpec } from '../boardRunSpecs';
import type { ItemRunSpec, RunAction } from '../boardRunSpecs';
import { itemStageLabel } from '../boardStages';
import {
  awaitsTriageDecision,
  cardActions,
  cardPrimaryAction,
  resumeTarget,
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
  runDisabled,
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
  pendingRunRoles,
  sessionStatus,
  onCreateSession,
  onStartRun,
  onRestartRun,
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
  runDisabled: boolean;
  /** Status text while a run trigger is resolving, before the run mutation starts. */
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
  pendingRunRoles: ReadonlyMap<string, FactoryRunPhase | undefined>;
  /** Live status of the card's bound sessions, resolved once for the whole board. */
  sessionStatus?: SessionRowStatus;
  /** Detail-panel fallback when the item has no run spec: open an empty session (no run). */
  onCreateSession: (spec: { branch: string; threadTitle: string }) => void;
  onStartRun: (spec: ItemRunSpec, action: RunAction, options?: { preapprovePlans?: boolean }) => void;
  onRestartRun: (spec: ItemRunSpec, action: RunAction, options?: { preapprovePlans?: boolean }) => void;
  onMove: (toStage: string) => void;
  onRemove: () => void;
}) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  const morph = useCardMorph({ openFor: deepLinkCommentId });

  const evaluating = evaluatingStage !== undefined;
  const busyLabel = proposal !== undefined && approvingDecisionId === proposal.id ? 'Starting…' : preparing;
  const runPending = pendingRunRoles.size > 0 || busyLabel !== undefined;
  const runSpec = itemRunSpec(item);
  const sessions = item.sessions;
  // Offer only runs whose session slot hasn't been used yet on this card.
  const runActions = runSpec === undefined ? [] : runSpec.actions.filter(action => !(action.role in sessions));
  const defaultRunAction = runActions.find(action => FACTORY_ROLE_STAGES[action.role] === columnStage) ?? runActions[0];
  // A Done-lane PR that's still open likely picked up commits after its
  // review; offer a manual re-review even though the review slot is used. The
  // run re-enters Reviewing and follows up in the existing thread.
  const reReviewAction =
    columnStage === 'done' &&
    item.source === 'github-pr' &&
    ['open', 'draft'].includes(pullRequestStatusForItem(item)) &&
    runSpec !== undefined
      ? runSpec.actions.find(action => action.role === 'review' && action.role in sessions)
      : undefined;
  // A card can land in a lane without its run ever starting — an approved plan
  // transitions to Building and writes the `work` session ref itself, so the
  // slot looks used and `runActions` filters Build out. Offer the lane's own
  // run from the menu so the card is never a dead end.
  const laneAction =
    runSpec !== undefined && reReviewAction === undefined
      ? runSpec.actions.find(action => FACTORY_ROLE_STAGES[action.role] === columnStage && action.role in sessions)
      : undefined;
  const threadSession = itemThreadSession(sessions);
  const wickStatus = threadSession !== undefined ? sessionStatus : undefined;
  const sessionHref =
    threadSession === undefined
      ? undefined
      : `/factories/${factoryId}/workspaces/${threadSession.sessionId}/threads/${threadSession.threadId}`;
  const primaryAction = cardPrimaryAction({
    item,
    columnStage,
    runSpec,
    runAction: defaultRunAction,
    resume: resumeTarget(columnStage, runSpec, sessions),
    proposal,
    hasSession: threadSession !== undefined,
    onApproveProposal,
    onStartRun,
    onRestartRun,
    onCreateSession,
    onMove,
  });
  const proposedRunLabel =
    proposal === undefined
      ? undefined
      : (runSpec?.actions.find(action => action.role === proposal.role)?.label ??
        defaultRunAction?.label ??
        'Start run');

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
    runs: [...pendingRunRoles].map(([role, phase]) => ({
      label: runSpec?.actions.find(action => action.role === role)?.label ?? 'Starting run',
      phase,
    })),
    preparing: busyLabel,
    decision,
    transitionReason,
    sessionStatus,
    heldAs: awaitsTriageDecision(item, columnStage) ? (item.triageType ?? undefined) : undefined,
  });
  const retryDecisionId = status.kind === 'error' ? status.retryDecisionId : undefined;

  const menu: WorkItemMenuProps = {
    item,
    columnStage,
    runSpec,
    runActions,
    reReviewAction,
    laneAction,
    proposal,
    proposedRunLabel,
    pendingRunRoles,
    runDisabled,
    approvingDecisionId,
    onStartRun,
    onRestartRun,
    onApproveProposal,
    onDismissProposal,
    onMove,
    onRemove,
  };

  // Acting collapses the panel first, so the result lands on the card it came from.
  // Dismissing a suggested run is the one entry that leaves it open.
  const panelMenu: WorkItemMenuProps = {
    ...menu,
    onStartRun: (spec, action, options) => {
      morph.closeDetails();
      onStartRun(spec, action, options);
    },
    onRestartRun: (spec, action, options) => {
      morph.closeDetails();
      onRestartRun(spec, action, options);
    },
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

  // A held card's decision, like a parked suggestion, is the person's to
  // release, so it stays on the card beside a finished triage session.
  const actions = cardActions({
    running: wickStatus !== undefined,
    waiting: status.kind === 'waiting' || status.kind === 'held',
    attention: wickStatus === 'ready',
    session: sessionLink(sessionHref),
    retry: retryButton({ decisionId: retryDecisionId, retryingDecisionId, onRetry: onRetryDecision }),
    run: runButton({
      action: primaryAction,
      pending: runPending,
      disabled: runDisabled,
      suggestion: status.kind === 'waiting' ? status.label : undefined,
    }),
  });

  return (
    <>
      <article
        ref={morph.cardRef}
        draggable={!evaluating}
        aria-label={item.title}
        aria-busy={evaluating || runPending || undefined}
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
          runPending && 'opacity-70',
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
