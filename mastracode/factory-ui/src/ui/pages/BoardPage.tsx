import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { useCompleteAuditEvents } from '../../hooks/useAuditEvents';
import { useFactoryAuth } from '../../hooks/useFactoryAuth';
import { INTAKE_SOURCES, stageContentCount } from '../domains/factory/boardCandidates';
import type { IntakeSource } from '../domains/factory/boardCandidates';
import { boardLoadingStages, boardStages, itemAppearsInStage } from '../domains/factory/boardStages';
import type { BoardKind } from '../domains/factory/boardStages';
import { BoardAutoRunToggle } from '../domains/factory/components/BoardAutoRunToggle';
import { BoardColumn } from '../domains/factory/components/BoardColumn';
import { BoardColumnEmptyState } from '../domains/factory/components/BoardColumnEmptyState';
import { BoardRelevanceFilters } from '../domains/factory/components/BoardRelevanceFilters';
import { CandidateCard } from '../domains/factory/components/CandidateCard';
import { FactoryPageShell } from '../domains/factory/components/FactoryPageShell';
import { InlineWorkItemComposer } from '../domains/factory/components/InlineWorkItemComposer';
import { IntakeColumnExtras } from '../domains/factory/components/IntakeColumnExtras';
import { WorkItemCard } from '../domains/factory/components/WorkItemCard';
import { useBoardComposer } from '../domains/factory/hooks/useBoardComposer';
import { useBoardDecisions } from '../domains/factory/hooks/useBoardDecisions';
import { useBoardIntake } from '../domains/factory/hooks/useBoardIntake';
import { useBoardItems } from '../domains/factory/hooks/useBoardItems';
import { useBoardRuns } from '../domains/factory/hooks/useBoardRuns';
import { useBoardScroll } from '../domains/factory/hooks/useBoardScroll';
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
  return <FactoryPageShell>{factory => <Board factory={factory} kind="work" />}</FactoryPageShell>;
}

export function ReviewBoardPage() {
  return <FactoryPageShell>{factory => <Board factory={factory} kind="review" />}</FactoryPageShell>;
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
  const selectedParticipantId = searchParams.get('teammate') || undefined;
  const selectedRelevanceTypes = boardRelevanceFromQuery(searchParams.get('relevance'), kind);
  const selectedLabels = boardLabelsFromQuery(searchParams.getAll('label'));

  const auth = useFactoryAuth();
  const items = useBoardItems({ factoryProjectId, kind });
  const intake = useBoardIntake({ factoryProjectId, repository, kind, knownSourceKeys: items.knownSourceKeys });
  const runs = useBoardRuns({
    factoryProjectId,
    projectRepositoryId: repository.projectRepositoryId,
    workItems: items.all,
    refetchItems: items.refetch,
  });
  const decisions = useBoardDecisions(factoryProjectId);
  const composer = useBoardComposer(factoryProjectId);
  const activityProfileActorIds = [...new Set(items.all.flatMap(workItemHumanActorIds))];
  const activity = useCompleteAuditEvents(factoryProjectId, `board-${kind}-activity`, 200, activityProfileActorIds);
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
      candidateMatchesLabels(candidate, selectedLabels),
  );
  const setParticipant = (participantId: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    next.delete('item');
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
    next.delete('item');
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
    next.delete('item');
    next.delete('label');
    for (const value of boardLabelsQueryValues(nextLabels)) next.append('label', value);
    setSearchParams(next, { replace: true });
  };
  const resetFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('teammate');
    next.delete('relevance');
    next.delete('label');
    next.delete('item');
    setSearchParams(next, { replace: true });
  };
  const setIntakeSource = (source: IntakeSource) => {
    if (targetItemId) {
      const next = new URLSearchParams(searchParams);
      next.delete('item');
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
        workItemMatchesLabels(item, selectedLabels, liveCandidate)
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
  const scroll = useBoardScroll({
    boardKey: `${factoryProjectId}:${kind}`,
    settled: loadingStages.size === 0,
    stages,
    targetItemId,
    targetReady,
    workItems: boardWorkItems,
    candidates: filteredCandidates,
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
  const anyFilterActive = selectedParticipantId !== undefined || selectedLabels.size > 0;
  const filtersExcludeAll = anyFilterActive && totalTaskCount === 0 && unfilteredTaskCount > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {mutationError !== undefined && (
        <Notice variant="destructive">
          {mutationError instanceof Error ? mutationError.message : 'Board action failed'}
        </Notice>
      )}
      <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-2">
        <BoardRelevanceFilters
          kind={kind}
          participants={participants}
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
          <BoardAutoRunToggle factoryProjectId={factoryProjectId} enabled={factory.autoRunEnabled ?? false} />
        </div>
      </div>
      <ScrollArea
        viewportRef={scroll.containerRef}
        orientation="horizontal"
        className="min-h-0 flex-1 [&_[data-hovering]:not([data-scrolling])]:opacity-0"
        viewPortClassName="overscroll-x-contain pb-2 *:h-full [container-type:inline-size] lg:overscroll-x-auto"
        aria-label="Board columns"
        onPointerDown={scroll.claimForUser}
        onWheel={scroll.claimForUser}
      >
        <div className="flex h-full min-h-0 gap-2 px-3 lg:gap-3 lg:px-0">
          {stages.map(stage => {
            const loading = loadingStages.has(stage.id);
            const stageWorkItems = workItemsForStage(stage.id);
            const taskCount = stageContentCount(stage.id, stages, stageWorkItems, filteredCandidates);
            const composerOpen = composer.stage === stage.id;
            return (
              <BoardColumn
                key={stage.id}
                stage={stage.id}
                label={stage.label}
                taskCount={taskCount}
                totalTaskCount={totalTaskCount}
                loading={loading}
                composerOpen={composerOpen}
                laneRef={scroll.registerLane(stage.id)}
                onDrop={items.handleDrop}
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
              >
                {composerOpen ? (
                  <InlineWorkItemComposer
                    stage={stage.id}
                    stageLabel={stage.label}
                    onCreate={title => composer.submit(stage.id, title)}
                    onClose={() => composer.close(stage.id)}
                  />
                ) : null}
                {stageWorkItems.map(item => (
                  <WorkItemCard
                    key={`${item.id}:${stage.id}`}
                    item={item}
                    highlighted={targetItemId === item.id}
                    columnStage={stage.id}
                    allItems={items.all}
                    activityPage={activityPage}
                    liveWorktreePaths={runs.liveWorktreePaths}
                    sessionLivenessResolved={runs.sessionLivenessResolved}
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
                    onStartRun={(_spec, action) => void runs.openOrStartRun(item, action.role)}
                    onRestartRun={(_spec, action) => void runs.restartRun(item, action.role)}
                    onMove={toStage => items.move(item.id, toStage)}
                    onRemove={() => items.remove(item.id)}
                  />
                ))}
                {filteredCandidates
                  .filter(candidate => candidate.column === stage.id)
                  .map(candidate => (
                    <CandidateCard
                      key={candidate.sourceKey}
                      candidate={candidate}
                      pendingRunRoles={runs.pendingRolesForSource(candidate.sourceKey)}
                      preparing={runs.preparingForSource(candidate.sourceKey)}
                      disabled={!runs.enabled}
                      onRun={(action, prompt) => runs.startCandidateRun(candidate, action, prompt)}
                      onFile={() => items.handleDrop({ kind: 'candidate', candidate }, candidate.column)}
                    />
                  ))}
                {loading && (
                  <SkeletonRows label={`Loading ${stage.label} column`} rows={3} rowClassName="h-24 w-full" />
                )}
                {!loading && !composerOpen && taskCount === 0 && (
                  <BoardColumnEmptyState
                    stage={stage.id}
                    kind={kind}
                    hasIntakeSource={intake.active !== undefined}
                    filtersExcludeAll={filtersExcludeAll}
                  />
                )}
                {stage.id === 'intake' && (
                  <IntakeColumnExtras
                    source={intake.active}
                    issues={intake.issues}
                    pulls={intake.pulls}
                    linearIssues={intake.linearIssues}
                  />
                )}
              </BoardColumn>
            );
          })}
        </div>
      </ScrollArea>
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
    <div role="group" aria-label="Intake source" className="flex items-center gap-1 pb-1">
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
