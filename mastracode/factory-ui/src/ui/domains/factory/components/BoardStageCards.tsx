import { Txt } from '@mastra/playground-ui/components/Txt';

import { SkeletonRows } from '../../../ui/SkeletonRows';
import type { BoardCandidate, IntakeFeed, IntakeSource } from '../boardCandidates';
import { SKELETON_ROW_CLASS } from '../boardLayout';
import type { BoardLayout } from '../boardLayout';
import type { BoardKind } from '../boardStages';
import type { CardMove } from '../cardPrimaryAction';
import type { FactoryDecisionSummary } from '../services/decisions';
import type { AuditEventPage } from '../services/audit';
import type { WorkItem } from '../services/workItems';
import type { BoardStageId } from '../stages';
import type { SessionRowStatus } from '../../workspaces/services/sessionStatus';
import { BoardColumnEmptyState } from './BoardColumnEmptyState';
import { CandidateCard } from './CandidateCard';
import { ColumnReveal } from './ColumnReveal';
import { InlineWorkItemComposer } from './InlineWorkItemComposer';
import { IntakeColumnExtras } from './IntakeColumnExtras';
import { IntakeFeedNotice } from './IntakeFeedNotice';
import { WorkItemCard } from './WorkItemCard';

export function BoardStageCards({
  stage,
  layout,
  kind,
  loading,
  taskCount,
  workItems,
  candidates,
  feed,
  intakeSource,
  filtersExcludeAll,
  alreadyMaterialized,
  composerOpen,
  onSubmitComposer,
  onCloseComposer,
  targetItemId,
  targetCommentId,
  registerDeepLinkedCard,
  relatedItemsFor,
  sessionStatuses,
  projectRepositoryId,
  factoryProjectId,
  activityPage,
  preparingFor,
  evaluatingStages,
  transitionReasons,
  effectByItem,
  proposalByItem,
  approvingDecisionId,
  retryingDecisionId,
  onApproveProposal,
  onDismissProposal,
  onRetryDecision,
  onCreateSession,
  onMoveItem,
  onRemoveItem,
  onRunCandidate,
}: {
  stage: { id: BoardStageId; label: string };
  layout: BoardLayout;
  kind: BoardKind;
  loading: boolean;
  taskCount: number;
  workItems: WorkItem[];
  candidates: BoardCandidate[];
  feed?: IntakeFeed;
  intakeSource?: IntakeSource;
  filtersExcludeAll: boolean;
  alreadyMaterialized: number;
  composerOpen: boolean;
  onSubmitComposer: (stage: BoardStageId, title: string) => Promise<void>;
  onCloseComposer: (stage: BoardStageId) => void;
  targetItemId?: string;
  targetCommentId?: string;
  registerDeepLinkedCard: (itemId: string) => (element: HTMLElement | null) => void;
  relatedItemsFor: (item: WorkItem) => WorkItem[];
  sessionStatuses: ReadonlyMap<string, SessionRowStatus>;
  projectRepositoryId: string;
  factoryProjectId: string;
  activityPage?: AuditEventPage;
  preparingFor: (itemId: string) => string | undefined;
  evaluatingStages: ReadonlyMap<string, string>;
  transitionReasons: Record<string, string>;
  effectByItem: ReadonlyMap<string, FactoryDecisionSummary>;
  proposalByItem: ReadonlyMap<string, FactoryDecisionSummary>;
  approvingDecisionId?: string;
  retryingDecisionId?: string;
  onApproveProposal: (decisionId: string) => void;
  onDismissProposal: (decisionId: string) => void;
  onRetryDecision: (decisionId: string) => void;
  onCreateSession: (item: WorkItem) => void;
  onMoveItem: (item: WorkItem, toStage: string) => void;
  onRemoveItem: (itemId: string) => void;
  onRunCandidate: (candidate: BoardCandidate, move: CardMove, prompt?: string) => void;
}) {
  const showEmptyState = !loading && !composerOpen && taskCount === 0 && !feed?.error;
  return (
    <>
      {composerOpen ? (
        <InlineWorkItemComposer
          stage={stage.id}
          stageLabel={stage.label}
          onCreate={title => onSubmitComposer(stage.id, title)}
          onClose={() => onCloseComposer(stage.id)}
        />
      ) : null}
      <ColumnReveal
        items={workItems}
        pinned={item => item.id === targetItemId}
        renderItem={item => (
          <WorkItemCard
            key={`${item.id}:${stage.id}`}
            layout={layout}
            item={item}
            deepLinkRef={registerDeepLinkedCard(item.id)}
            deepLinkCommentId={targetItemId === item.id ? targetCommentId : undefined}
            highlighted={targetItemId === item.id}
            columnStage={stage.id}
            relatedItems={relatedItemsFor(item)}
            sessionStatus={sessionStatuses.get(item.id)}
            projectRepositoryId={projectRepositoryId}
            activityPage={activityPage}
            preparing={preparingFor(item.id)}
            evaluatingStage={evaluatingStages.get(item.id)}
            transitionReason={transitionReasons[item.id]}
            decision={effectByItem.get(item.id)}
            proposal={proposalByItem.get(item.id)}
            approvingDecisionId={approvingDecisionId}
            retryingDecisionId={retryingDecisionId}
            onApproveProposal={onApproveProposal}
            onDismissProposal={onDismissProposal}
            onRetryDecision={onRetryDecision}
            onCreateSession={() => onCreateSession(item)}
            onMove={toStage => onMoveItem(item, toStage)}
            onRemove={() => onRemoveItem(item.id)}
          />
        )}
      />
      {workItems.length > 0 && candidates.length > 0 ? (
        <div role="separator" aria-label="New candidates" className="flex items-center gap-2 py-1">
          <span aria-hidden className="bg-border h-px flex-1" />
          <Txt as="span" variant="meta" tone="muted">
            New candidates
          </Txt>
          <span aria-hidden className="bg-border h-px flex-1" />
        </div>
      ) : null}
      <ColumnReveal
        items={candidates}
        renderItem={candidate => (
          <CandidateCard
            key={candidate.sourceKey}
            layout={layout}
            candidate={candidate}
            projectRepositoryId={projectRepositoryId}
            factoryProjectId={factoryProjectId}
            onRun={(move, prompt) => onRunCandidate(candidate, move, prompt)}
          />
        )}
      />
      {loading && (
        <SkeletonRows label={`Loading ${stage.label} column`} rows={3} rowClassName={SKELETON_ROW_CLASS[layout]} />
      )}
      {showEmptyState && (
        <BoardColumnEmptyState
          stage={stage.id}
          kind={kind}
          hasIntakeSource={intakeSource !== undefined}
          filtersExcludeAll={filtersExcludeAll}
          alreadyMaterialized={alreadyMaterialized}
          layout={layout}
        />
      )}
      {feed && <IntakeFeedNotice source={intakeSource} feed={feed} />}
      {feed && <IntakeColumnExtras feed={feed} currentColumnLength={taskCount} layout={layout} />}
    </>
  );
}
