import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { useRecentAuditEvents } from '../../hooks/useAuditEvents';
import { useFactoryAuth } from '../../hooks/useFactoryAuth';
import { INTAKE_SOURCES, stageContentCount } from '../domains/factory/boardCandidates';
import type { IntakeSource } from '../domains/factory/boardCandidates';
import { boardLoadingStages, boardStages, itemAppearsInStage } from '../domains/factory/boardStages';
import type { BoardKind } from '../domains/factory/boardStages';
import { BoardAutomationSettings } from '../domains/factory/components/BoardAutomationSettings';
import { BoardTooltipDelay } from '../domains/factory/components/BoardCardParts';
import { BoardColumn, BoardColumnHeader } from '../domains/factory/components/BoardColumn';
import { BoardColumnEmptyState } from '../domains/factory/components/BoardColumnEmptyState';
import { ColumnReveal } from '../domains/factory/components/ColumnReveal';
import { BoardRelevanceFilters } from '../domains/factory/components/BoardRelevanceFilters';
import { CandidateCard } from '../domains/factory/components/CandidateCard';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { InlineWorkItemComposer } from '../domains/factory/components/InlineWorkItemComposer';
import { IntakeColumnExtras } from '../domains/factory/components/IntakeColumnExtras';
import { IntakeFeedNotice } from '../domains/factory/components/IntakeFeedNotice';
import { WorkItemCard } from '../domains/factory/components/WorkItemCard';
import { useBoardComposer } from '../domains/factory/hooks/useBoardComposer';
import { useBoardDeepLink } from '../domains/factory/hooks/useBoardDeepLink';
import { useBoardDecisions } from '../domains/factory/hooks/useBoardDecisions';
import { useBoardIntake } from '../domains/factory/hooks/useBoardIntake';
import { useItemSessionStatuses } from '../domains/factory/hooks/useItemSessionStatuses';
import { useBoardItems } from '../domains/factory/hooks/useBoardItems';
import { useBoardRuns } from '../domains/factory/hooks/useBoardRuns';
import { isTerminalStage } from '../domains/factory/stages';
import {
  boardLabels,
  boardLabelsFromQuery,
  boardLabelsQueryValues,
  boardParticipants,
  boardRelevanceFromQuery,
  boardRelevanceQueryValue,
  candidateMatchesLabels,
  candidateMatchesRelevance,
  workItemMatchesLabels,
  workItemMatchesRelevance,
} from '../domains/factory/boardRelevance';
import type { BoardRelevanceType } from '../domains/factory/boardRelevance';
import { cardMatchesSearch } from '../domains/factory/boardItems';
import { relatedWorkItemIndex } from '../domains/factory/services/relationships';
import { workItemHumanActorIds } from '../domains/factory/workItemActivity';
import type { FactoryProject, LinkedRepositoryPayload } from '../domains/workspaces/services/github';
import { SkeletonRows } from '../ui/SkeletonRows';
import { settingsSectionPath } from '../domains/settings/settingsSections';

/**
 * Factory › Board: an org-wide kanban over the repository's work items. The
 * Intake column merges persisted `intake` cards with live GitHub/Linear
 * candidates (issues and PRs that have no record yet — records are
 * materialized only when someone acts on them). Everything enters through
 * Intake and moves through the system from there. Cards move between columns
 * by drag-and-drop or the card menu; moves only file/move cards, never start
 * agent runs.
 */
export function WorkBoardPage() {
  return <FactoryPageShell bleed>{factory => <Board factory={factory} kind="work" />}</FactoryPageShell>;
}

export function ReviewBoardPage() {
  return <FactoryPageShell bleed>{factory => <Board factory={factory} kind="review" />}</FactoryPageShell>;
}

function Board({ factory, kind }: { factory: FactoryProject; kind: BoardKind }) {
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

  return <BoardContent factory={factory} repository={repository} kind={kind} />;
}

/** The open card and the comment it deep-links to are one selection: clear them together. */
function clearOpenCard(params: URLSearchParams) {
  params.delete('item');
  params.delete('comment');
}

function BoardContent({
  factory,
  repository,
  kind,
}: {
  factory: FactoryProject;
  repository: LinkedRepositoryPayload;
  kind: BoardKind;
}) {
  const factoryProjectId = factory.id;
  const review = kind === 'review';
  const stages = boardStages(kind);
  const [searchParams, setSearchParams] = useSearchParams();
  const targetItemId = searchParams.get('item') || undefined;
  const targetCommentId = targetItemId !== undefined ? (searchParams.get('comment') ?? undefined) : undefined;
  const selectedParticipantId = searchParams.get('teammate') || undefined;
  const search = searchParams.get('q') ?? '';
  const selectedRelevanceTypes = boardRelevanceFromQuery(searchParams.get('relevance'), kind);
  const selectedLabels = boardLabelsFromQuery(searchParams.getAll('label'));

  const auth = useFactoryAuth();
  const items = useBoardItems({ factoryProjectId, kind });
  const intake = useBoardIntake({ factoryProjectId, repository, kind, knownSourceKeys: items.knownSourceKeys });
  const runs = useBoardRuns({
    factoryProjectId,
    workItems: items.all,
    refetchItems: items.refetch,
  });
  const relatedItemsFor = relatedWorkItemIndex(items.all);
  const sessionStatuses = useItemSessionStatuses({
    projectRepositoryId: repository.projectRepositoryId,
    items: items.all,
  });
  const decisions = useBoardDecisions(factoryProjectId);
  const composer = useBoardComposer(factoryProjectId);
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
      candidateMatchesRelevance(candidate, selectedParticipantId, selectedRelevanceTypes) &&
      candidateMatchesLabels(candidate, selectedLabels) &&
      cardMatchesSearch(candidate, search),
  );
  const setSearch = (next: string) => {
    const params = new URLSearchParams(searchParams);
    clearOpenCard(params);
    if (next.trim()) params.set('q', next);
    else params.delete('q');
    setSearchParams(params, { replace: true });
  };
  const setParticipant = (participantId: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    clearOpenCard(next);
    if (participantId) next.set('teammate', participantId);
    else {
      next.delete('teammate');
      next.delete('relevance');
    }
    setSearchParams(next, { replace: true });
  };
  const setRelevanceType = (type: BoardRelevanceType, selected: boolean) => {
    const nextTypes = new Set(selectedRelevanceTypes);
    if (selected) nextTypes.add(type);
    else nextTypes.delete(type);
    const next = new URLSearchParams(searchParams);
    clearOpenCard(next);
    const value = boardRelevanceQueryValue(nextTypes, kind);
    if (value) next.set('relevance', value);
    else next.delete('relevance');
    setSearchParams(next, { replace: true });
  };
  const setLabel = (label: string, selected: boolean) => {
    const nextLabels = new Set(selectedLabels);
    if (selected) nextLabels.add(label);
    else nextLabels.delete(label);
    const next = new URLSearchParams(searchParams);
    clearOpenCard(next);
    next.delete('label');
    for (const value of boardLabelsQueryValues(nextLabels)) next.append('label', value);
    setSearchParams(next, { replace: true });
  };
  const resetFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('teammate');
    next.delete('relevance');
    next.delete('label');
    next.delete('q');
    clearOpenCard(next);
    setSearchParams(next, { replace: true });
  };
  const setIntakeSource = (source: IntakeSource) => {
    if (targetItemId) {
      const next = new URLSearchParams(searchParams);
      clearOpenCard(next);
      setSearchParams(next, { replace: true });
    }
    intake.select(source);
  };
  const unfilteredWorkItemsForStage = (stage: (typeof stages)[number]['id']) =>
    items.visible.filter(item => {
      if (!itemAppearsInStage(item, stage, stages)) return false;
      if (item.id === targetItemId) return true;
      if (stage !== 'intake' || review || item.source === 'manual') return true;
      if (intake.active === 'github') return item.source === 'github-issue';
      if (intake.active === 'linear') return item.source === 'linear-issue';
      return false;
    });
  const workItemsForStage = (stage: (typeof stages)[number]['id']) =>
    unfilteredWorkItemsForStage(stage).filter(item => {
      const liveCandidate = item.sourceKey ? participantCandidateBySourceKey.get(item.sourceKey) : undefined;
      return (
        workItemMatchesRelevance(item, activityPage, selectedParticipantId, selectedRelevanceTypes, liveCandidate) &&
        workItemMatchesLabels(item, selectedLabels, liveCandidate) &&
        cardMatchesSearch(item, search)
      );
    });
  const boardWorkItems = stages.flatMap(stage => workItemsForStage(stage.id));
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
  const anyFilterActive = selectedParticipantId !== undefined || selectedLabels.size > 0 || search !== '';
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
      collapsed: stage.id !== 'intake' && !loading && !composerOpen && !feedFailed && taskCount === 0,
    };
  });

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
                search={search}
                onSearchChange={setSearch}
                selectedParticipantId={selectedParticipantId}
                selectedTypes={selectedRelevanceTypes}
                availableLabels={availableLabels}
                selectedLabels={selectedLabels}
                currentUserId={auth.data?.user?.userId}
                onParticipantChange={setParticipant}
                onTypeChange={setRelevanceType}
                onLabelChange={setLabel}
                onReset={resetFilters}
              />
              <div className="w-full lg:w-auto [&>div]:w-full [&>div]:justify-between lg:[&>div]:w-auto lg:[&>div]:justify-start">
                <BoardAutomationSettings
                  factoryProjectId={factoryProjectId}
                  autoRunEnabled={factory.autoRunEnabled ?? false}
                  autoApprovePlans={factory.autoApprovePlans ?? false}
                />
              </div>
            </div>
            <div className="from-surface2 via-surface2 sticky top-0 z-20 flex items-start gap-2 via-[calc(100%-0.75rem)] to-transparent px-5 max-lg:bg-linear-to-b max-lg:pb-3 lg:gap-3">
              {stageViews.map(({ stage, loading, taskCount, composerOpen, collapsed }) => (
                <BoardColumnHeader
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
                    !isTerminalStage(stage.id) &&
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
                    stage.id === 'intake' && intake.showSwitch ? (
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
                    <ColumnReveal
                      items={stageWorkItems}
                      pinned={item => item.id === targetItemId}
                      renderItem={item => (
                        <WorkItemCard
                          key={`${item.id}:${stage.id}`}
                          item={item}
                          deepLinkRef={registerDeepLinkedCard(item.id)}
                          deepLinkCommentId={targetItemId === item.id ? targetCommentId : undefined}
                          highlighted={targetItemId === item.id}
                          columnStage={stage.id}
                          relatedItems={relatedItemsFor(item)}
                          sessionStatus={sessionStatuses.get(item.id)}
                          projectRepositoryId={repository.projectRepositoryId}
                          activityPage={activityPage}
                          runDisabled={runs.disabled}
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
                          pendingRunRoles={runs.pendingRolesFor(item.id)}
                          onCreateSession={() => void runs.openOrCreateSession(item, stage.id)}
                          onStartRun={(_spec, action, options) => void runs.openOrStartRun(item, action.role, options)}
                          onRestartRun={(_spec, action, options) => void runs.restartRun(item, action.role, options)}
                          onMove={toStage => items.move(item.id, toStage)}
                          onRemove={() => items.remove(item.id)}
                        />
                      )}
                    />
                    <ColumnReveal
                      items={stageCandidates}
                      renderItem={candidate => (
                        <CandidateCard
                          key={candidate.sourceKey}
                          candidate={candidate}
                          projectRepositoryId={repository.projectRepositoryId}
                          factoryProjectId={factoryProjectId}
                          pendingRunRoles={runs.pendingRolesForSource(candidate.sourceKey)}
                          preparing={runs.preparingForSource(candidate.sourceKey)}
                          disabled={!runs.enabled}
                          onRun={(action, prompt) => runs.startCandidateRun(candidate, action, prompt)}
                          onFile={() => items.handleDrop({ kind: 'candidate', candidate }, candidate.column)}
                        />
                      )}
                    />
                    {loading && (
                      <SkeletonRows label={`Loading ${stage.label} column`} rows={3} rowClassName="h-24 w-full" />
                    )}
                    {!loading && !composerOpen && taskCount === 0 && !feedFailed && (
                      <BoardColumnEmptyState
                        stage={stage.id}
                        kind={kind}
                        hasIntakeSource={intake.active !== undefined}
                        filtersExcludeAll={filtersExcludeAll}
                      />
                    )}
                    {columnFeed && <IntakeFeedNotice source={intake.active} feed={columnFeed} />}
                    {stage.id === 'intake' && <IntakeColumnExtras feed={columnFeed} />}
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

function IntakeSourceSwitch({
  available,
  active,
  onSelect,
}: {
  available: readonly IntakeSource[];
  active?: IntakeSource;
  onSelect: (source: IntakeSource) => void;
}) {
  return (
    <div role="group" aria-label="Intake source" className="flex items-center gap-1">
      {INTAKE_SOURCES.filter(source => available.includes(source.id)).map(source => (
        <button
          key={source.id}
          type="button"
          aria-pressed={active === source.id}
          onClick={() => onSelect(source.id)}
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-ui-xs transition',
            active === source.id
              ? 'border-accent1 bg-surface4 text-icon6'
              : 'border-border1 bg-transparent text-icon3 hover:text-icon5',
          )}
        >
          {source.label}
        </button>
      ))}
    </div>
  );
}
