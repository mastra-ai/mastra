import { Notice } from '@mastra/playground-ui/components/Notice';
import { toast } from '@mastra/playground-ui/components/Toaster';
import type { InstalledBoardInfo } from '../../../api/types';

import { useRecentAuditEvents } from '../../../hooks/useAuditEvents';
import { cardMatchesSourceFilters, hasBoardSourceFilters } from '../../domains/factory/boardSourceFilters';
import { useFactoryAuth } from '../../../hooks/useFactoryAuth';
import { stageContentCount } from '../../domains/factory/boardCandidates';
import type { BoardCandidate } from '../../domains/factory/boardCandidates';
import { boardLoadingStages, itemAppearsInStage } from '../../domains/factory/boardStages';
import type { BoardKind } from '../../domains/factory/boardStages';
import { BoardAutomationSettings } from '../../domains/factory/components/BoardAutomationSettings';
import { RepositoryPickerDialog } from '../../domains/factory/components/RepositoryPickerDialog';
import { BoardStageCards } from '../../domains/factory/components/BoardStageCards';
import { BoardEmptyStateActions } from '../../domains/factory/components/BoardEmptyStateActions';
import { BoardStageCreateButton } from '../../domains/factory/components/BoardStageCreateButton';
import { BoardViewControls } from '../../domains/factory/components/BoardViewControls';
import { useBoardComposer } from '../../domains/factory/hooks/useBoardComposer';
import { useBoardDeepLink } from '../../domains/factory/hooks/useBoardDeepLink';
import { useCollapsedStages } from '../../domains/factory/hooks/useCollapsedStages';
import { useBoardDecisions } from '../../domains/factory/hooks/useBoardDecisions';
import { useBoardIntake } from '../../domains/factory/hooks/useBoardIntake';
import { useItemSessionStatuses } from '../../domains/factory/hooks/useItemSessionStatuses';
import { useBoardItems } from '../../domains/factory/hooks/useBoardItems';
import { useBoardRuns } from '../../domains/factory/hooks/useBoardRuns';
import { useRepositoryChoice } from '../../domains/factory/hooks/useRepositoryChoice';
import {
  boardLabels,
  boardParticipants,
  candidateMatchesLabels,
  candidateMatchesRelevance,
  workItemMatchesLabels,
  workItemMatchesRelevance,
} from '../../domains/factory/boardRelevance';
import { boardFiltersActive } from '../../domains/factory/boardFilters';
import { useBoardView } from '../../domains/factory/hooks/useBoardView';
import { BUSY_CARD_MOVE_REFUSAL, canMoveTo } from '../../domains/factory/boardCardState';
import { candidatePayload } from '../../domains/factory/boardDrag';
import type { DragPayload } from '../../domains/factory/boardDrag';
import { cardMatchesSearch, isPersistedCandidate } from '../../domains/factory/boardItems';
import { orderWorkItemsForStage } from '../../domains/factory/boardOrder';
import type { WorkItem } from '../../domains/factory/services/workItems';
import { relatedWorkItemIndex } from '../../domains/factory/services/relationships';
import { workItemHumanActorIds } from '../../domains/factory/workItemActivity';
import type { FactoryProject, LinkedRepositoryPayload } from '../../domains/workspaces/services/github';

import { VirtualBoardItems } from '../../domains/factory/components/VirtualBoardItems';
import { WorkItemCard } from '../../domains/factory/components/WorkItemCard';
import { InlineWorkItemComposer } from '../../domains/factory/components/InlineWorkItemComposer';
import { BoardStageCandidates } from '../../domains/factory/components/BoardStageCandidates';
import { BoardStages } from './BoardStages';
import { cardProjectRepositoryId } from '../../domains/factory/boardRepository';

/** Count all available candidates before source filters so empty states can explain excluded cards. */
function countUnfilteredCandidates({
  sourceFiltered,
  candidates,
  participantCandidates,
  knownSourceKeys,
}: {
  sourceFiltered: boolean;
  candidates: readonly BoardCandidate[];
  participantCandidates: readonly BoardCandidate[];
  knownSourceKeys: ReadonlySet<string>;
}): number {
  if (!sourceFiltered) return candidates.length;
  return participantCandidates.filter(candidate => !isPersistedCandidate(knownSourceKeys, candidate)).length;
}

// One item can sit in several stages; each copy is its own card.
const workItemCardKey = (stageId: string, itemId: string) => `${stageId}/${itemId}`;

export function BoardContent({
  factory,
  repository,
  kind,
  definition,
}: {
  factory: FactoryProject;
  repository: LinkedRepositoryPayload;
  kind: BoardKind;
  definition: InstalledBoardInfo;
}) {
  const factoryProjectId = factory.id;
  const review = kind === 'review';
  const builtin = kind === 'work' || review;
  const stages = definition.phases.map(phase => ({ ...phase, label: phase.title }));
  const auth = useFactoryAuth();
  const currentUserId = auth.data?.user?.userId;
  const view = useBoardView({ factoryProjectId, kind, currentUserId });
  const { searchParams, filters, sort, layout } = view;
  const targetItemId = searchParams.get('item') || undefined;
  const targetCommentId = targetItemId !== undefined ? (searchParams.get('comment') ?? undefined) : undefined;

  const items = useBoardItems({ factoryProjectId, kind, currentUserId });
  const repositoryChoice = useRepositoryChoice(factory, definition);
  const cardForDrop = (payload: DragPayload) => {
    if (payload.kind === 'candidate') return payload.candidate;
    return items.all.find(item => item.id === payload.id);
  };
  const dropWithRepository = (
    payload: DragPayload,
    stage: Parameters<typeof items.handleDrop>[1],
    cause = 'board_drag',
  ) => {
    if (payload.kind === 'work-item') {
      if (payload.fromStage === stage) return;
      const toPhaseKind = definition.phases.find(phase => phase.id === stage)?.kind;
      if (!canMoveTo(payload.ownerKind, toPhaseKind)) {
        toast.error(BUSY_CARD_MOVE_REFUSAL);
        return;
      }
    }
    const card = cardForDrop(payload);
    if (!card) return;
    void repositoryChoice.choose(
      card.source,
      card.metadata,
      stage,
      slug => {
        if (payload.kind === 'work-item') items.move(payload.id, stage, { cause, repositorySlug: slug });
        else
          items.handleDrop(
            {
              ...payload,
              candidate: { ...payload.candidate, metadata: { ...payload.candidate.metadata, repository: slug } },
            },
            stage,
            cause,
          );
      },
      () => items.handleDrop(payload, stage, cause),
    );
  };
  const intake = useBoardIntake({
    factoryProjectId,
    repositories: factory.repositories,
    definition,
    knownSourceKeys: items.knownSourceKeys,
    elsewhereSourceKeys: items.elsewhereSourceKeys,
    sourceFilters: filters,
  });
  const sourceFiltered = hasBoardSourceFilters(filters);
  const runs = useBoardRuns({ factoryProjectId, refetchItems: items.refetch });
  const relatedItemsFor = relatedWorkItemIndex(items.all);
  const sessionStatuses = useItemSessionStatuses({
    factoryProjectId,
    projectRepositoryId: repository.projectRepositoryId,
    items: items.all,
  });
  const decisions = useBoardDecisions(factoryProjectId);
  const composer = useBoardComposer(factoryProjectId, definition, currentUserId);
  const activityProfileActorIds = [...new Set(items.all.flatMap(workItemHumanActorIds))];
  const activity = useRecentAuditEvents(factoryProjectId, `board-${kind}-activity`, 200, activityProfileActorIds);
  const activityPage = activity.data;
  const participants = boardParticipants({
    items: items.all,
    candidates: intake.participantCandidates,
    activityPage,
    currentUser: auth.data?.user,
  });
  const participantCandidateBySourceKey = new Map(
    intake.participantCandidates.map(candidate => [candidate.sourceKey, candidate]),
  );
  const availableLabels = boardLabels({ items: items.all, candidates: intake.participantCandidates });
  const candidateMatchesView = (candidate: BoardCandidate): boolean => {
    if (!candidateMatchesRelevance(candidate, filters.participantIds, filters.relevanceTypes)) return false;
    if (!candidateMatchesLabels(candidate, filters.labels)) return false;
    if (!cardMatchesSourceFilters(candidate, filters)) return false;
    return cardMatchesSearch(candidate, view.search);
  };
  const filteredCandidates = intake.candidates.filter(candidateMatchesView);
  const unfilteredWorkItemsForStage = (stage: (typeof stages)[number]['id']) =>
    items.visible.filter(item => itemAppearsInStage(item, stage, stages));
  const workItemMatchesView = (item: WorkItem): boolean => {
    const liveCandidate = item.sourceKey ? participantCandidateBySourceKey.get(item.sourceKey) : undefined;
    if (!workItemMatchesRelevance(item, activityPage, filters.participantIds, filters.relevanceTypes, liveCandidate))
      return false;
    if (!workItemMatchesLabels(item, filters.labels, liveCandidate)) return false;
    if (!cardMatchesSourceFilters(item, filters, liveCandidate)) return false;
    return cardMatchesSearch(item, view.search);
  };
  const workItemsForStage = (stage: (typeof stages)[number]['id']) => {
    const matchingItems = unfilteredWorkItemsForStage(stage).filter(workItemMatchesView);
    return orderWorkItemsForStage(matchingItems, stage, sort, currentUserId);
  };
  const workItemsByStage = new Map(stages.map(stage => [stage.id, workItemsForStage(stage.id)]));
  const boardWorkItems = [...workItemsByStage.values()].flat();
  const targetReady = !items.isPending && (!targetItemId || boardWorkItems.some(item => item.id === targetItemId));
  const loadingStages = boardLoadingStages({
    stages,
    itemsPending: items.isPending,
    intakePending: intake.isPending,
    triagePending: intake.isTriagePending,
  });
  const registerDeepLinkedCard = useBoardDeepLink({
    boardKey: `${factoryProjectId}:${kind}`,
    targetItemId,
    targetReady,
  });
  const targetStages = stages
    .filter(stage => workItemsByStage.get(stage.id)?.some(item => item.id === targetItemId))
    .map(stage => stage.id);
  const collapsedStages = useCollapsedStages(
    targetItemId && targetStages.length > 0
      ? { itemId: targetItemId, commentId: targetCommentId, stages: targetStages }
      : undefined,
  );

  if (items.error !== undefined) {
    return (
      <div className="p-4">
        <Notice variant="destructive" className="max-w-xl">
          {items.error instanceof Error ? items.error.message : 'Failed to load the board'}
        </Notice>
      </div>
    );
  }

  const mutationError = runs.error ?? decisions.error ?? items.mutationError;
  const visibleWorkItems = new Set(boardWorkItems);
  const unfilteredVisibleWorkItems = new Set(stages.flatMap(stage => unfilteredWorkItemsForStage(stage.id)));
  const totalTaskCount = visibleWorkItems.size + filteredCandidates.length;
  const unfilteredCandidateCount = countUnfilteredCandidates({
    sourceFiltered,
    candidates: intake.candidates,
    participantCandidates: intake.participantCandidates,
    knownSourceKeys: items.knownSourceKeys,
  });
  const unfilteredTaskCount = unfilteredVisibleWorkItems.size + unfilteredCandidateCount;
  const anyFilterActive = boardFiltersActive(filters, kind) || view.search.trim() !== '';
  const filtersExcludeAll = anyFilterActive && totalTaskCount === 0 && unfilteredTaskCount > 0;
  const hasIntakeSource = intake.available.length > 0;

  const stageViews = stages.map(stage => {
    const isInitialPhase = stage.id === definition.initialPhase;
    const loading = loadingStages.has(stage.id);
    const stageWorkItems = workItemsByStage.get(stage.id) ?? [];
    const stageCandidates = filteredCandidates.filter(candidate => candidate.column === stage.id);
    const taskCount = stageContentCount(stage.id, stages, stageWorkItems, filteredCandidates);
    const composerOpen = composer.stage === stage.id;
    const columnFeed = intake.feedByColumn[stage.id];
    const feedFailed = Boolean(columnFeed?.error);
    const canCreate =
      !review && !loading && stage.kind !== 'terminal' && (composer.stage === undefined || composerOpen);
    const canConnectSource = isInitialPhase && !hasIntakeSource;
    const showEmptyStateActions = isInitialPhase && (filtersExcludeAll || canCreate || canConnectSource);
    const collapsed =
      builtin &&
      !isInitialPhase &&
      !loading &&
      !composerOpen &&
      !feedFailed &&
      !columnFeed?.hasNextPage &&
      taskCount === 0;
    return {
      stage,
      phaseKind: builtin ? undefined : stage.kind,
      loading,
      taskCount,
      collapsed,
      groupOpen: collapsedStages.isStageOpen(stage.id),
      onGroupOpenChange: (open: boolean) => collapsedStages.setStageOpen(stage.id, open),
      createButton: canCreate ? (
        <BoardStageCreateButton
          stage={stage}
          expanded={composerOpen}
          triggerRef={composer.registerTrigger(stage.id)}
          onOpen={() => {
            collapsedStages.setStageOpen(stage.id, true);
            composer.open(stage.id);
          }}
        />
      ) : undefined,
      cards: (
        <BoardStageCards
          stage={stage}
          isInitialPhase={isInitialPhase}
          layout={layout}
          kind={kind}
          loading={loading}
          taskCount={taskCount}
          feed={columnFeed}
          intakeSource={intake.active}
          hasIntakeSource={hasIntakeSource}
          filtersExcludeAll={filtersExcludeAll}
          alreadyMaterialized={isInitialPhase ? intake.alreadyMaterialized : 0}
          emptyStateActions={
            showEmptyStateActions && (
              <BoardEmptyStateActions
                factoryId={factoryProjectId}
                connectSource={canConnectSource}
                onCreate={canCreate ? () => composer.open(stage.id) : undefined}
                onClearFilters={filtersExcludeAll ? view.clearFilters : undefined}
              />
            )
          }
          composer={
            composerOpen && (
              <InlineWorkItemComposer
                stage={stage.id}
                stageLabel={stage.label}
                onCreate={title => composer.submit(stage.id, title)}
                onClose={() => composer.close(stage.id)}
              />
            )
          }
        >
          <VirtualBoardItems
            items={stageWorkItems}
            itemKey={item => workItemCardKey(stage.id, item.id)}
            layout={layout}
            pinnedKey={targetItemId && workItemCardKey(stage.id, targetItemId)}
            renderItem={item => (
              <WorkItemCard
                layout={layout}
                item={item}
                deepLinkRef={registerDeepLinkedCard(item.id)}
                highlighted={targetItemId === item.id}
                columnStage={stage.id}
                relatedItems={relatedItemsFor(item)}
                sessionStatus={sessionStatuses.get(item.id)}
                projectRepositoryId={cardProjectRepositoryId(
                  factory.repositories,
                  item,
                  repository.projectRepositoryId,
                )}
                activityPage={activityPage}
                preparing={runs.preparingFor(item.id)}
                evaluatingStage={items.evaluatingStages.get(item.id)}
                transitionReason={items.transitionReasons[item.id]}
                decision={decisions.effectByItem.get(item.id)}
                proposal={decisions.proposalByItem.get(item.id)}
                approvingDecisionId={decisions.approvingId}
                retryingDecisionId={decisions.retryingId}
                onApproveProposal={decisions.approve}
                onDismissProposal={decisions.dismiss}
                onRetryDecision={decisions.retry}
                onCreateSession={() => void runs.openOrCreateSession(item)}
                onMove={toStage =>
                  void repositoryChoice.choose(
                    item.source,
                    item.metadata,
                    toStage,
                    slug => items.move(item.id, toStage, { repositorySlug: slug }),
                    () => items.move(item.id, toStage),
                  )
                }
                onRemove={() => items.remove(item.id)}
              />
            )}
          />
          <BoardStageCandidates
            candidates={stageCandidates}
            afterWorkItems={stageWorkItems.length > 0}
            layout={layout}
            projectRepositoryId={candidate =>
              cardProjectRepositoryId(factory.repositories, candidate, repository.projectRepositoryId)
            }
            factoryProjectId={factoryProjectId}
            onRun={(candidate, move, prompt) =>
              dropWithRepository(candidatePayload(candidate, prompt), move.stage, 'card_action')
            }
          />
        </BoardStageCards>
      ),
    };
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {runs.repositorySelection && (
        <RepositoryPickerDialog
          repositories={runs.repositoryChoices}
          onClose={runs.closeRepositorySelection}
          onSelect={runs.selectRepository}
        />
      )}
      {repositoryChoice.pending && (
        <RepositoryPickerDialog
          repositories={factory.repositories}
          onClose={repositoryChoice.cancel}
          onSelect={selectedRepository => repositoryChoice.select(selectedRepository.slug)}
        />
      )}
      {mutationError !== undefined && (
        <div className="shrink-0 p-4 pb-0">
          <Notice variant="destructive">
            {mutationError instanceof Error ? mutationError.message : 'Board action failed'}
          </Notice>
        </div>
      )}
      <BoardStages
        layout={layout}
        stages={stageViews}
        totalTaskCount={totalTaskCount}
        linkedComment={
          targetItemId !== undefined && targetCommentId !== undefined && targetStages[0] !== undefined
            ? { cardKey: workItemCardKey(targetStages[0], targetItemId), commentId: targetCommentId }
            : undefined
        }
        onDrop={dropWithRepository}
        toolbar={
          <BoardViewControls
            kind={kind}
            view={view}
            participants={participants}
            availableLabels={availableLabels}
            currentUserId={currentUserId}
            aside={
              builtin && (
                <BoardAutomationSettings
                  factoryProjectId={factoryProjectId}
                  autoRunEnabled={factory.autoRunEnabled ?? false}
                  autoApprovePlans={factory.autoApprovePlans ?? false}
                  reviewTestChecksEnabled={factory.reviewTestChecksEnabled ?? false}
                  selfReviewEnabled={factory.selfReviewEnabled ?? false}
                />
              )
            }
          />
        }
      />
    </div>
  );
}
