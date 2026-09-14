import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { Plus } from 'lucide-react';
import { Link, useParams } from 'react-router';
import type { InstalledBoardInfo } from '../../api/types';

import { useRecentAuditEvents } from '../../hooks/useAuditEvents';
import { useBoardCatalog } from '../../hooks/useBoardCatalog';
import { useFactoryAuth } from '../../hooks/useFactoryAuth';
import { IntakeSourceSwitch } from '../domains/factory/board-view/IntakeSourceSwitch';
import { useBoardSearchParams } from '../domains/factory/board-view/useBoardSearchParams';
import { stageContentCount } from '../domains/factory/boardCandidates';
import type { IntakeSource, BoardCandidate } from '../domains/factory/boardCandidates';
import { candidatePayload } from '../domains/factory/boardDrag';
import { cardMatchesSearch } from '../domains/factory/boardItems';
import {
  boardLabels,
  boardParticipants,
  candidateMatchesLabels,
  candidateMatchesRelevance,
  workItemMatchesLabels,
  workItemMatchesRelevance,
} from '../domains/factory/boardRelevance';
import { boardLoadingStages, itemAppearsInStage } from '../domains/factory/boardStages';
import type { BoardKind } from '../domains/factory/boardStages';
import { BoardAutomationSettings } from '../domains/factory/components/BoardAutomationSettings';
import { BoardTooltipDelay } from '../domains/factory/components/BoardCardParts';
import { BoardColumn, BoardColumnHeader } from '../domains/factory/components/BoardColumn';
import { BoardColumnEmptyState } from '../domains/factory/components/BoardColumnEmptyState';
import { BoardRelevanceFilters } from '../domains/factory/components/BoardRelevanceFilters';
import { CandidateCard } from '../domains/factory/components/CandidateCard';
import { ColumnReveal } from '../domains/factory/components/ColumnReveal';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { InlineWorkItemComposer } from '../domains/factory/components/InlineWorkItemComposer';
import { IntakeColumnExtras } from '../domains/factory/components/IntakeColumnExtras';
import { IntakeFeedNotice } from '../domains/factory/components/IntakeFeedNotice';
import { WorkItemCard } from '../domains/factory/components/WorkItemCard';
import { useBoardComposer } from '../domains/factory/hooks/useBoardComposer';
import { useBoardDecisions } from '../domains/factory/hooks/useBoardDecisions';
import { useBoardDeepLink } from '../domains/factory/hooks/useBoardDeepLink';
import { useBoardIntake } from '../domains/factory/hooks/useBoardIntake';
import { useBoardItems } from '../domains/factory/hooks/useBoardItems';
import { useBoardRuns } from '../domains/factory/hooks/useBoardRuns';
import { useItemSessionStatuses } from '../domains/factory/hooks/useItemSessionStatuses';
import { ReviewColumnCards } from '../domains/factory/review-stacks/ReviewColumnCards';
import { buildReviewStackIndex, reviewCards } from '../domains/factory/review-stacks/reviewStacks';
import { relatedWorkItemIndex } from '../domains/factory/services/relationships';
import type { WorkItem } from '../domains/factory/services/workItems';
import { workItemHumanActorIds } from '../domains/factory/workItemActivity';
import { settingsSectionPath } from '../domains/settings/settingsSections';
import type { FactoryProject, LinkedRepositoryPayload } from '../domains/workspaces/services/github';
import { SkeletonRows } from '../ui/SkeletonRows';

export function WorkBoardPage() {
  return <FactoryPageShell bleed>{factory => <Board factory={factory} kind="work" />}</FactoryPageShell>;
}

export function ReviewBoardPage() {
  return <FactoryPageShell bleed>{factory => <Board factory={factory} kind="review" />}</FactoryPageShell>;
}

export function CustomBoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  return <FactoryPageShell bleed>{factory => <Board factory={factory} kind={boardId ?? ''} />}</FactoryPageShell>;
}

function Board({ factory, kind }: { factory: FactoryProject; kind: BoardKind }) {
  const catalog = useBoardCatalog(factory.id);
  if (catalog.isPending) return <p role="status">Loading boards…</p>;
  if (catalog.isError) return <p role="alert">Unable to load boards.</p>;
  const definition = catalog.data.find(board => board.id === kind);
  if (!definition) return <p role="alert">Board unavailable: this board is not installed.</p>;
  return <InstalledBoard factory={factory} definition={definition} />;
}

function InstalledBoard({ factory, definition }: { factory: FactoryProject; definition: InstalledBoardInfo }) {
  const kind = definition.id;
  const repository = factory.repositories[0];
  const review = kind === 'review';

  if (!repository) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-8">
        <EmptyState
          as="h2"
          iconSlot={<GithubIcon className="text-icon3 size-10" />}
          titleSlot={review ? 'Connect a repository to start reviewing' : 'Connect a repository to start intake'}
          descriptionSlot={
            review
              ? 'Link a GitHub repository in Repository settings. Its pull requests will appear in Intake, ready to move through review.'
              : 'Link a GitHub repository in Repository settings. Its issues will appear in Intake, ready to move through planning and build.'
          }
          actionSlot={
            <Link
              to={settingsSectionPath(factory.id, 'repositories')}
              className={buttonVariants({ variant: 'primary' })}
            >
              Open Repository settings
            </Link>
          }
        />
      </div>
    );
  }

  return <BoardContent factory={factory} repository={repository} kind={kind} definition={definition} />;
}

function BoardContent({
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
  const filters = useBoardSearchParams(kind);

  const auth = useFactoryAuth();
  const items = useBoardItems({ factoryProjectId, kind });
  const intake = useBoardIntake({
    factoryProjectId,
    repository,
    definition,
    knownSourceKeys: items.knownSourceKeys,
    elsewhereSourceKeys: items.elsewhereSourceKeys,
  });
  const runs = useBoardRuns({ factoryProjectId, refetchItems: items.refetch });
  const relatedItemsFor = relatedWorkItemIndex(items.all);
  const reviewStacks = buildReviewStackIndex(review ? reviewCards(items.visible, intake.candidates) : []);
  const sessionStatuses = useItemSessionStatuses({
    factoryProjectId,
    projectRepositoryId: repository.projectRepositoryId,
    items: items.all,
  });
  const decisions = useBoardDecisions(factoryProjectId);
  const composer = useBoardComposer(factoryProjectId, definition);
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
  const filteredCandidates = intake.candidates.filter(
    candidate =>
      candidateMatchesRelevance(candidate, filters.selectedParticipantId, filters.selectedRelevanceTypes) &&
      candidateMatchesLabels(candidate, filters.selectedLabels) &&
      cardMatchesSearch(candidate, filters.search),
  );
  const setIntakeSource = (source: IntakeSource) => {
    filters.clearSelection();
    intake.select(source);
  };
  const unfilteredWorkItemsForStage = (stage: (typeof stages)[number]['id']) =>
    items.visible.filter(item => {
      if (!itemAppearsInStage(item, stage, stages)) return false;
      if (item.id === filters.targetItemId) return true;
      if (stage !== definition.initialPhase || review || item.source === 'manual') return true;
      if (intake.active === 'github') return item.source === 'github-issue';
      if (intake.active === 'linear') return item.source === 'linear-issue';
      return false;
    });
  const workItemsForStage = (stage: (typeof stages)[number]['id']) =>
    unfilteredWorkItemsForStage(stage).filter(item => {
      const liveCandidate = item.sourceKey ? participantCandidateBySourceKey.get(item.sourceKey) : undefined;
      return (
        workItemMatchesRelevance(
          item,
          activityPage,
          filters.selectedParticipantId,
          filters.selectedRelevanceTypes,
          liveCandidate,
        ) &&
        workItemMatchesLabels(item, filters.selectedLabels, liveCandidate) &&
        cardMatchesSearch(item, filters.search)
      );
    });
  const boardWorkItems = stages.flatMap(stage => workItemsForStage(stage.id));
  const targetReady =
    !items.isPending && (!filters.targetItemId || boardWorkItems.some(item => item.id === filters.targetItemId));
  const loadingStages = boardLoadingStages({
    stages,
    itemsPending: items.isPending,
    intakePending: intake.isPending,
    triagePending: intake.isTriagePending,
  });
  const registerDeepLinkedCard = useBoardDeepLink({
    boardKey: `${factoryProjectId}:${kind}`,
    targetItemId: filters.targetItemId,
    targetReady,
  });

  if (items.error !== undefined) {
    return (
      <Notice variant="destructive">
        {items.error instanceof Error ? items.error.message : 'Failed to load the board'}
      </Notice>
    );
  }

  const mutationError = runs.error ?? decisions.error ?? items.mutationError;
  const visibleWorkItems = new Set(boardWorkItems);
  const unfilteredVisibleWorkItems = new Set(stages.flatMap(stage => unfilteredWorkItemsForStage(stage.id)));
  const totalTaskCount = visibleWorkItems.size + filteredCandidates.length;
  const unfilteredTaskCount = unfilteredVisibleWorkItems.size + intake.candidates.length;
  const anyFilterActive =
    filters.selectedParticipantId !== undefined || filters.selectedLabels.size > 0 || filters.search !== '';
  const filtersExcludeAll = anyFilterActive && totalTaskCount === 0 && unfilteredTaskCount > 0;

  const stageViews = stages.map(stage => {
    const loading = loadingStages.has(stage.id);
    const stageWorkItems = workItemsForStage(stage.id);
    const stageCandidates = filteredCandidates.filter(candidate => candidate.column === stage.id);
    const taskCount = stageContentCount(stage.id, stages, stageWorkItems, filteredCandidates);
    const composerOpen = composer.stage === stage.id;
    const columnFeed = intake.feedByColumn[stage.id];
    const feedFailed = Boolean(columnFeed?.error);
    return {
      stage,
      loading,
      stageWorkItems,
      stageCandidates,
      taskCount,
      composerOpen,
      columnFeed,
      feedFailed,
      collapsed:
        builtin && stage.id !== definition.initialPhase && !loading && !composerOpen && !feedFailed && taskCount === 0,
    };
  });

  const renderWorkItem = (stage: string) => (item: WorkItem) => (
    <WorkItemCard
      key={`${item.id}:${stage}`}
      item={item}
      deepLinkRef={registerDeepLinkedCard(item.id)}
      deepLinkCommentId={filters.targetItemId === item.id ? filters.targetCommentId : undefined}
      highlighted={filters.targetItemId === item.id}
      columnStage={stage}
      relatedItems={relatedItemsFor(item)}
      sessionStatus={sessionStatuses.get(item.id)}
      projectRepositoryId={repository.projectRepositoryId}
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
      onMove={(toStage, options) => items.move(item.id, toStage, options)}
      onRemove={() => items.remove(item.id)}
    />
  );
  const renderCandidate = (candidate: BoardCandidate) => (
    <CandidateCard
      key={candidate.sourceKey}
      candidate={candidate}
      projectRepositoryId={repository.projectRepositoryId}
      factoryProjectId={factoryProjectId}
      onRun={(move, prompt) => items.handleDrop(candidatePayload(candidate, prompt), move.stage, 'card_action')}
      onFile={() => items.handleDrop(candidatePayload(candidate), candidate.column)}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {mutationError !== undefined && (
        <div className="shrink-0 p-5 pb-0">
          <Notice variant="destructive">
            {mutationError instanceof Error ? mutationError.message : 'Board action failed'}
          </Notice>
        </div>
      )}
      <div className="[container-type:inline-size] min-h-0 flex-1 overflow-auto overscroll-x-contain [scrollbar-gutter:stable] lg:overscroll-x-auto">
        <div className="flex min-h-full w-max min-w-full flex-col gap-3">
          <div className="from-surface2 via-surface2 z-20 flex flex-col gap-3 bg-linear-to-b via-[calc(100%-1rem)] to-transparent pb-4 max-lg:contents lg:sticky lg:top-0">
            <div className="sticky left-0 flex w-[100cqw] flex-col items-stretch gap-3 px-5 pt-5 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-2">
              <BoardRelevanceFilters
                kind={kind}
                participants={participants}
                search={filters.search}
                onSearchChange={filters.setSearch}
                selectedParticipantId={filters.selectedParticipantId}
                selectedTypes={filters.selectedRelevanceTypes}
                availableLabels={availableLabels}
                selectedLabels={filters.selectedLabels}
                currentUserId={auth.data?.user?.userId}
                onParticipantChange={filters.setParticipant}
                onTypeChange={filters.setRelevanceType}
                onLabelChange={filters.setLabel}
                onReset={filters.resetFilters}
              />
              <div className="w-full lg:w-auto [&>div]:w-full [&>div]:justify-between lg:[&>div]:w-auto lg:[&>div]:justify-start">
                {builtin && (
                  <BoardAutomationSettings
                    factoryProjectId={factoryProjectId}
                    autoRunEnabled={factory.autoRunEnabled ?? false}
                    autoApprovePlans={factory.autoApprovePlans ?? false}
                  />
                )}
              </div>
            </div>
            <div className="from-surface2 via-surface2 sticky top-0 z-20 flex items-start gap-2 via-[calc(100%-0.75rem)] to-transparent px-5 max-lg:bg-linear-to-b max-lg:pb-3 lg:gap-3">
              {stageViews.map(({ stage, loading, taskCount, composerOpen, collapsed }) => (
                <BoardColumnHeader
                  phaseKind={stage.kind}
                  key={stage.id}
                  stage={stage.id}
                  label={stage.label}
                  taskCount={taskCount}
                  totalTaskCount={totalTaskCount}
                  loading={loading}
                  collapsed={collapsed}
                  headerAction={
                    !review &&
                    !loading &&
                    stage.kind !== 'terminal' &&
                    (composer.stage === undefined || composerOpen) ? (
                      <Button
                        ref={composer.registerTrigger(stage.id)}
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Create work item in ${stage.label}`}
                        title={`Create work item in ${stage.label}`}
                        aria-expanded={composerOpen}
                        aria-controls={`new-work-item-${stage.id}`}
                        onClick={() => composer.open(stage.id)}
                      >
                        <Plus size={13} aria-hidden />
                      </Button>
                    ) : undefined
                  }
                  headerExtras={
                    stage.id === definition.initialPhase && intake.showSwitch ? (
                      <IntakeSourceSwitch
                        available={intake.available}
                        active={intake.active}
                        onSelect={setIntakeSource}
                      />
                    ) : undefined
                  }
                />
              ))}
            </div>
          </div>
          <BoardTooltipDelay>
            <div role="group" aria-label="Board columns" className="flex flex-1 items-stretch gap-2 px-5 pb-5 lg:gap-3">
              {stageViews.map(
                ({
                  stage,
                  loading,
                  stageWorkItems,
                  stageCandidates,
                  taskCount,
                  composerOpen,
                  columnFeed,
                  feedFailed,
                  collapsed,
                }) => (
                  <BoardColumn
                    key={stage.id}
                    stage={stage.id}
                    label={stage.label}
                    collapsed={collapsed}
                    onDrop={items.handleDrop}
                  >
                    {composerOpen ? (
                      <InlineWorkItemComposer
                        stage={stage.id}
                        stageLabel={stage.label}
                        onCreate={title => composer.submit(stage.id, title)}
                        onClose={() => composer.close(stage.id)}
                      />
                    ) : null}
                    {review ? (
                      <ReviewColumnCards
                        workItems={stageWorkItems}
                        candidates={stageCandidates}
                        stacks={reviewStacks}
                        targetItemId={filters.targetItemId}
                        renderWorkItem={renderWorkItem(stage.id)}
                        renderCandidate={renderCandidate}
                      />
                    ) : (
                      <>
                        <ColumnReveal items={stageWorkItems} pinned={item => item.id === filters.targetItemId}>
                          {visibleItems => visibleItems.map(renderWorkItem(stage.id))}
                        </ColumnReveal>
                        <ColumnReveal items={stageCandidates}>
                          {visibleCandidates => visibleCandidates.map(renderCandidate)}
                        </ColumnReveal>
                      </>
                    )}
                    {loading && (
                      <SkeletonRows label={`Loading ${stage.label} column`} rows={3} rowClassName="h-24 w-full" />
                    )}
                    {!loading && !composerOpen && taskCount === 0 && !feedFailed && (
                      <BoardColumnEmptyState
                        stage={stage.id}
                        kind={kind}
                        hasIntakeSource={intake.active !== undefined}
                        filtersExcludeAll={filtersExcludeAll}
                        alreadyMaterialized={stage.id === definition.initialPhase ? intake.alreadyMaterialized : 0}
                      />
                    )}
                    {columnFeed && <IntakeFeedNotice source={intake.active} feed={columnFeed} />}
                    {stage.id === definition.initialPhase && <IntakeColumnExtras feed={columnFeed} />}
                  </BoardColumn>
                ),
              )}
            </div>
          </BoardTooltipDelay>
        </div>
      </div>
    </div>
  );
}
