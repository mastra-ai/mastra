import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowUpRight, CircleSlash, EllipsisVertical, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router';

import type { FactoryRunPhase } from '../../../../hooks/useStartFactoryRun';
import { boardCardStatus } from '../boardCardStatus';
import { setDragPayload } from '../boardDrag';
import {
  externalLinkLabel,
  itemThreadSession,
  liveSessions,
  metadataLabels,
  pullRequestStatusForItem,
  workItemMeta,
} from '../boardItems';
import { itemRunSpec, itemSessionSpec } from '../boardRunSpecs';
import type { ItemRunSpec, RunAction } from '../boardRunSpecs';
import { itemStageLabel, itemStageOptions } from '../boardStages';
import type { AuditEventPage } from '../services/audit';
import type { FactoryDecisionSummary } from '../services/decisions';
import { relatedWorkItems, relationshipPath } from '../services/relationships';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';
import { workItemActivity } from '../workItemActivity';
import {
  CardIdleOverlay,
  CardLabels,
  CardStatus,
  CardTitleTooltip,
  REVEAL_ON_CARD_HOVER,
  SourceTitle,
} from './BoardCardParts';
import { BoardStageIcon, SourceIcon, actionIcon } from './BoardIcons';
import { PullRequestStatusIcon } from './PullRequestStatusIcon';
import { RelatedWorkItemLink } from './RelatedWorkItemLink';
import { WorkItemActivity } from './WorkItemActivity';

interface CardPrimaryAction {
  label: string;
  ariaLabel: string;
  start: () => void;
}

/** A proposed run wins the click: releasing it beats starting a rival run beside it. */
function cardPrimaryAction({
  item,
  runSpec,
  runAction,
  proposal,
  onApproveProposal,
  onStartRun,
  onCreateSession,
}: {
  item: WorkItem;
  runSpec?: ItemRunSpec;
  runAction?: RunAction;
  proposal?: FactoryDecisionSummary;
  onApproveProposal: (decisionId: string) => void;
  onStartRun: (spec: ItemRunSpec, action: RunAction) => void;
  onCreateSession: (spec: { branch: string; threadTitle: string }) => void;
}): CardPrimaryAction {
  if (proposal !== undefined) {
    const proposed = runSpec?.actions.find(action => action.role === proposal.role) ?? runAction;
    const label = proposed?.label ?? 'Start run';
    return { label, ariaLabel: `${label} ${item.title}`, start: () => onApproveProposal(proposal.id) };
  }
  if (runSpec !== undefined && runAction !== undefined) {
    return {
      label: runAction.label,
      ariaLabel: `${runAction.label} ${item.title}`,
      start: () => onStartRun(runSpec, runAction),
    };
  }
  return {
    label: 'Start session',
    ariaLabel: `Start session for ${item.title}`,
    start: () => onCreateSession(itemSessionSpec(item)),
  };
}

export function WorkItemCard({
  item,
  highlighted,
  columnStage,
  allItems,
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
  allItems: WorkItem[];
  activityPage?: AuditEventPage;
  /** Worktrees that still exist; session refs outside this set are stale. */
  liveWorktreePaths: ReadonlySet<string>;
  sessionLivenessResolved: boolean;
  runDisabled: boolean;
  /** Status text while the click is resolving, before the run mutation starts. */
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
  /** Card click fallback when the item has no run spec: open an empty session (no run). */
  onCreateSession: (spec: { branch: string; threadTitle: string }) => void;
  onStartRun: (spec: ItemRunSpec, action: RunAction) => void;
  /** Re-run an action whose session slot is already used (e.g. re-review an updated PR). */
  onRestartRun: (spec: ItemRunSpec, action: RunAction) => void;
  onMove: (toStage: string) => void;
  onRemove: () => void;
}) {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
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
  const primaryAction = cardPrimaryAction({
    item,
    runSpec,
    runAction: defaultRunAction,
    proposal,
    onApproveProposal,
    onStartRun,
    onCreateSession,
  });
  const threadSession = itemThreadSession(sessions);
  const proposedRunLabel =
    proposal === undefined
      ? undefined
      : (runSpec?.actions.find(action => action.role === proposal.role)?.label ??
        defaultRunAction?.label ??
        'Start run');

  const relatedItems = relatedWorkItems(item, allItems);
  const labels = metadataLabels(item.metadata);
  const activity = workItemActivity(item, activityPage);
  const status = boardCardStatus({
    idle:
      threadSession !== undefined
        ? { label: 'Open session', affordance: 'open' }
        : { label: primaryAction.label, affordance: 'run' },
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
  const showIdleAction = status.kind === 'idle';
  const showStatusRow = activity.lastWorker !== undefined || status.kind !== 'idle';

  return (
    <CardTitleTooltip title={item.title}>
      <article
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
          evaluating ? 'cursor-wait' : 'cursor-grab active:cursor-grabbing',
          runPending && 'opacity-70',
          highlighted && 'border-warning1/40 bg-warning1/5 ring-1 ring-warning1/30',
        )}
      >
        {threadSession !== undefined ? (
          <Link
            to={`/factories/${factoryId}/workspaces/${threadSession.sessionId}/threads/${threadSession.threadId}`}
            draggable={false}
            aria-label={`Open session for ${item.title}`}
            className="focus-visible:outline-accent1 absolute inset-0 cursor-pointer rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        ) : (
          <button
            type="button"
            draggable={false}
            disabled={runDisabled || runPending}
            aria-busy={runPending || undefined}
            aria-label={primaryAction.ariaLabel}
            className="focus-visible:outline-accent1 absolute inset-0 cursor-pointer rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed"
            onClick={primaryAction.start}
          />
        )}
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
              {runSpec !== undefined &&
                runActions.map(action => {
                  const starting = pendingRunRoles.has(action.role);
                  return (
                    <DropdownMenu.Item
                      key={action.label}
                      disabled={runDisabled || starting}
                      onClick={() => onStartRun(runSpec, action)}
                    >
                      {actionIcon(action.label)}
                      <span>{starting ? 'Starting…' : action.label}</span>
                    </DropdownMenu.Item>
                  );
                })}
              {runSpec !== undefined && reReviewAction !== undefined && (
                <DropdownMenu.Item
                  disabled={runDisabled || pendingRunRoles.has(reReviewAction.role)}
                  onClick={() => onRestartRun(runSpec, reReviewAction)}
                >
                  {actionIcon(reReviewAction.label)}
                  <span>{pendingRunRoles.has(reReviewAction.role) ? 'Starting…' : 'Re-review'}</span>
                </DropdownMenu.Item>
              )}
              {runSpec !== undefined && laneAction !== undefined && (
                <DropdownMenu.Item
                  disabled={runDisabled || pendingRunRoles.has(laneAction.role)}
                  onClick={() => onRestartRun(runSpec, laneAction)}
                >
                  {actionIcon(laneAction.label)}
                  <span>{pendingRunRoles.has(laneAction.role) ? 'Starting…' : laneAction.label}</span>
                </DropdownMenu.Item>
              )}
              {/* Once the card has a live session it renders as a link, so the
                  menu is the only place left to release a proposed run. */}
              {proposal !== undefined && (
                <DropdownMenu.Item
                  disabled={runDisabled || approvingDecisionId === proposal.id}
                  onClick={() => onApproveProposal(proposal.id)}
                >
                  {actionIcon(proposedRunLabel ?? 'Start run')}
                  <span>{approvingDecisionId === proposal.id ? 'Starting…' : 'Start suggested run'}</span>
                </DropdownMenu.Item>
              )}
              {proposal !== undefined && (
                <DropdownMenu.Item onClick={() => onDismissProposal(proposal.id)}>
                  <CircleSlash aria-hidden />
                  <span>Dismiss suggested run</span>
                </DropdownMenu.Item>
              )}
              {item.url !== null && (
                <DropdownMenu.Item render={<a href={item.url} target="_blank" rel="noreferrer" />}>
                  <ArrowUpRight aria-hidden />
                  <span>{externalLinkLabel(item.source)}</span>
                </DropdownMenu.Item>
              )}
              {itemStageOptions(item)
                .filter(stage => stage.id !== columnStage)
                .map(stage => (
                  <DropdownMenu.Item key={stage.id} onClick={() => onMove(stage.id)}>
                    <BoardStageIcon stage={stage.id} />
                    <span>{stage.id === 'done' ? 'Mark done' : `Move to ${stage.label}`}</span>
                  </DropdownMenu.Item>
                ))}
              <DropdownMenu.Item onClick={onRemove}>
                <Trash2 aria-hidden />
                <span>Remove</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5 pr-8">
            <span className="text-ui-xs text-icon2 min-w-0 truncate">{workItemMeta(item)}</span>
            {threadSession !== undefined && (
              <span data-live-session-indicator aria-hidden className="bg-accent1 size-2 shrink-0 rounded-full" />
            )}
            {relatedItems.map(related => {
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
                <RelatedWorkItemLink
                  key={related.id}
                  item={related}
                  href={relationshipPath(related, factoryId)}
                  kind="board"
                />
              );
            })}
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
        {showIdleAction && <CardIdleOverlay status={status} />}
        {showStatusRow && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <WorkItemActivity activity={activity} actors={activityPage?.actors ?? {}} />
            {status.kind !== 'idle' && (
              <CardStatus
                status={status}
                onApprove={
                  status.kind === 'waiting' && !runDisabled ? () => onApproveProposal(status.decisionId) : undefined
                }
                approving={status.kind === 'waiting' && approvingDecisionId === status.decisionId}
                onRetry={retryDecisionId === undefined ? undefined : () => onRetryDecision(retryDecisionId)}
                retrying={retryDecisionId !== undefined && retryDecisionId === retryingDecisionId}
              />
            )}
          </div>
        )}
      </article>
    </CardTitleTooltip>
  );
}
