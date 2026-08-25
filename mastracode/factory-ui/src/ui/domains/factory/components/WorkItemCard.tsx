import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { cn } from '@mastra/playground-ui/utils/cn';
import { EllipsisVertical } from 'lucide-react';
import type { ReactElement } from 'react';
import { useParams } from 'react-router';

import type { FactoryRunPhase } from '../../../../hooks/useStartFactoryRun';
import { boardCardStatus } from '../boardCardStatus';
import { setDragPayload } from '../boardDrag';
import { itemThreadSession, liveSessions, metadataLabels, pullRequestStatusForItem, workItemMeta } from '../boardItems';
import { itemRunSpec } from '../boardRunSpecs';
import type { ItemRunSpec, RunAction } from '../boardRunSpecs';
import { itemStageLabel } from '../boardStages';
import { cardPrimaryAction } from '../cardPrimaryAction';
import { useCardMorph } from '../hooks/useCardMorph';
import type { AuditEventPage } from '../services/audit';
import type { FactoryDecisionSummary } from '../services/decisions';
import { relationshipPath } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';
import { workItemActivity } from '../workItemActivity';
import {
  CardDetailsHint,
  CardLabels,
  CardStatus,
  CardTitleTooltip,
  REVEAL_ON_CARD_HOVER,
  SourceTitle,
} from './BoardCardParts';
import { SourceIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';
import { RelatedWorkItemLink } from './RelatedWorkItemLink';
import { WorkItemActivity } from './WorkItemActivity';
import { WorkItemDetailsPanel } from './WorkItemDetailsPanel';
import type { WorkItemMenuProps } from './WorkItemMenuItems';
import { WorkItemMenuItems } from './WorkItemMenuItems';

export function WorkItemCard({
  item,
  highlighted,
  columnStage,
  relatedItems,
  projectRepositoryId,
  activityPage,
  liveWorktreePaths,
  sessionLivenessResolved,
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
  onCreateSession,
  onStartRun,
  onRestartRun,
  onMove,
  onRemove,
}: {
  item: WorkItem;
  highlighted: boolean;
  columnStage: BoardStageId;
  /** Cards linked to this one, resolved once for the whole board. */
  relatedItems: WorkItem[];
  /** Repository id resolving GitHub descriptions in the detail panel. */
  projectRepositoryId: string;
  activityPage?: AuditEventPage;
  /** Worktrees that still exist; session refs outside this set are stale. */
  liveWorktreePaths: ReadonlySet<string>;
  sessionLivenessResolved: boolean;
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
  /** Detail-panel fallback when the item has no run spec: open an empty session (no run). */
  onCreateSession: (spec: { branch: string; threadTitle: string }) => void;
  onStartRun: (spec: ItemRunSpec, action: RunAction) => void;
  onRestartRun: (spec: ItemRunSpec, action: RunAction) => void;
  onMove: (toStage: string) => void;
  onRemove: () => void;
}) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  const morph = useCardMorph();

  const evaluating = evaluatingStage !== undefined;
  const busyLabel = proposal !== undefined && approvingDecisionId === proposal.id ? 'Starting…' : preparing;
  const runPending = pendingRunRoles.size > 0 || busyLabel !== undefined;
  const otherStages = item.stages.filter(stage => stage !== columnStage);
  const runSpec = itemRunSpec(item);
  const sessions = liveSessions(item.sessions, liveWorktreePaths);
  // Offer only runs whose session slot hasn't been used yet on this card.
  const runActions = runSpec === undefined ? [] : runSpec.actions.filter(action => !(action.role in sessions));
  const defaultRunAction = runActions[0];
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
      ? runSpec.actions.find(action => action.stage === columnStage && action.role in sessions)
      : undefined;
  const threadSession = itemThreadSession(sessions);
  const primaryAction = cardPrimaryAction({
    item,
    runSpec,
    runAction: defaultRunAction,
    proposal,
    hasSession: threadSession !== undefined,
    onApproveProposal,
    onStartRun,
    onCreateSession,
  });
  const proposedRunLabel =
    proposal === undefined
      ? undefined
      : (runSpec?.actions.find(action => action.role === proposal.role)?.label ??
        defaultRunAction?.label ??
        'Start run');

  const labels = metadataLabels(item.metadata);
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

  // Acting from inside the panel collapses it first: the card the panel came
  // from is what the result lands on. Dismissing a suggested run is the one
  // entry that leaves it open — nothing else about the card changed.
  const panelMenu: WorkItemMenuProps = {
    ...menu,
    onStartRun: (spec, action) => {
      morph.closeDetails();
      onStartRun(spec, action);
    },
    onRestartRun: (spec, action) => {
      morph.closeDetails();
      onRestartRun(spec, action);
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
    const relatedSession = sessionLivenessResolved
      ? itemThreadSession(liveSessions(related.sessions, liveWorktreePaths))
      : undefined;

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

    if (sessionLivenessResolved && related.url !== null) {
      return <RelatedWorkItemLink key={related.id} item={related} href={related.url} kind="external" />;
    }

    return (
      <RelatedWorkItemLink key={related.id} item={related} href={relationshipPath(related, factoryId)} kind="board" />
    );
  };

  return (
    <>
      <CardTitleTooltip title={item.title}>
        <article
          ref={morph.cardRef}
          draggable={!evaluating}
          aria-label={item.title}
          aria-busy={evaluating || runPending || undefined}
          data-testid="work-item-card"
          data-related={relatedItems.length > 0 ? 'true' : undefined}
          data-work-item-id={item.id}
          data-highlighted={highlighted || undefined}
          onDragStart={event => {
            if (!evaluating) setDragPayload(event, { kind: 'work-item', id: item.id, fromStage: columnStage });
          }}
          className={cn(
            'group relative flex flex-col gap-3 rounded-xl border border-border1/50 bg-neutral6/5 p-3 outline-none transition-colors hover:bg-surface3',
            // Offscreen cards skip layout and paint; a column can hold hundreds.
            '[content-visibility:auto] [contain-intrinsic-size:auto_7rem]',
            evaluating ? 'cursor-wait' : 'cursor-grab active:cursor-grabbing',
            runPending && 'opacity-70',
            highlighted && 'border-warning1/40 bg-warning1/5 ring-1 ring-warning1/30',
          )}
        >
          <button
            type="button"
            draggable={false}
            aria-label={`Details for ${item.title}`}
            aria-expanded={morph.open}
            className="focus-visible:outline-accent1 absolute inset-0 cursor-pointer rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={morph.openDetails}
          />
          <div className="absolute top-2 right-2 z-20">
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
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex min-w-0 items-center gap-1.5 pr-8">
              <span className="text-ui-xs text-icon2 min-w-0 truncate">{workItemMeta(item)}</span>
              {threadSession !== undefined && (
                <span data-live-session-indicator aria-hidden className="bg-accent1 size-2 shrink-0 rounded-full" />
              )}
              {relatedItems.map(relatedLink)}
            </div>
            <div className="flex min-w-0 items-center gap-1.5">
              {item.source === 'github-pr' ? (
                <PullRequestStatusIcon status={pullRequestStatusForItem(item)} />
              ) : (
                <SourceIcon source={item.source} />
              )}
              <span className="text-ui-smd text-icon6 min-w-0 flex-1 truncate font-semibold">
                <SourceTitle source={item.source} title={item.title} />
              </span>
            </div>
          </div>
          <CardLabels labels={labels} />
          {otherStages.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {otherStages.map(stage => (
                <span key={stage} className="border-border1 text-ui-xs text-icon4 rounded-full border px-2 py-0.5">
                  {itemStageLabel(item, stage)}
                </span>
              ))}
            </div>
          )}
          {status.kind === 'idle' && (
            <CardDetailsHint className="pointer-events-none pointer-fine:absolute pointer-fine:right-3 pointer-fine:bottom-3 pointer-fine:z-20 pointer-fine:ml-0" />
          )}
          {(activity.lastWorker !== undefined || status.kind !== 'idle') && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <WorkItemActivity activity={activity} actors={activityPage?.actors ?? {}} />
              <CardStatus
                status={status}
                onApprove={
                  status.kind === 'waiting' && !runDisabled ? () => onApproveProposal(status.decisionId) : undefined
                }
                approving={status.kind === 'waiting' && approvingDecisionId === status.decisionId}
                onRetry={retryDecisionId === undefined ? undefined : () => onRetryDecision(retryDecisionId)}
                retrying={retryDecisionId !== undefined && retryDecisionId === retryingDecisionId}
              />
            </div>
          )}
        </article>
      </CardTitleTooltip>

      <WorkItemDetailsPanel
        item={item}
        columnStage={columnStage}
        projectRepositoryId={projectRepositoryId}
        activityPage={activityPage}
        morph={morph}
        relatedLinks={relatedItems.map(relatedLink)}
        threadSession={threadSession}
        status={status}
        retryingDecisionId={retryingDecisionId}
        onRetryDecision={onRetryDecision}
        primaryAction={primaryAction}
        runDisabled={runDisabled}
        runPending={runPending}
        menu={<WorkItemMenuItems {...panelMenu} />}
      />
    </>
  );
}
