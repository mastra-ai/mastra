import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { cn } from '@mastra/playground-ui/utils/cn';
import { GitBranch, Plus } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { InstalledBoardInfo } from '../../api/types';
import { useBoardCatalog } from '../../hooks/useBoardCatalog';

import { useRecentAuditEvents } from '../../hooks/useAuditEvents';
import { useFactoryAuth } from '../../hooks/useFactoryAuth';
import { INTAKE_SOURCES, stageContentCount } from '../domains/factory/boardCandidates';
import type { IntakeSource } from '../domains/factory/boardCandidates';
import { boardLoadingStages, itemAppearsInStage } from '../domains/factory/boardStages';
import type { BoardKind } from '../domains/factory/boardStages';
import { BoardAutomationSettings } from '../domains/factory/components/BoardAutomationSettings';
import { BoardTooltipDelay } from '../domains/factory/components/BoardCardParts';
import { BoardColumn, BoardColumnHeader } from '../domains/factory/components/BoardColumn';
import { BoardColumnEmptyState } from '../domains/factory/components/BoardColumnEmptyState';
import { ColumnReveal } from '../domains/factory/components/ColumnReveal';
import { BoardFilters } from '../domains/factory/components/BoardFilters';
import { BoardSortControl } from '../domains/factory/components/BoardSortControl';
import { CandidateCard } from '../domains/factory/components/CandidateCard';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { useSidebarHeaderSlots } from '../domains/chat/components/useSidebarHeaderSlots';
import { useActiveFactory } from '../domains/workspaces/components/FactoryLayout';
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
  boardParticipants,
  candidateMatchesLabels,
  candidateMatchesRelevance,
  workItemMatchesLabels,
  workItemMatchesRelevance,
} from '../domains/factory/boardRelevance';
import { boardFilterParams, boardFiltersActive, boardFiltersFromParams } from '../domains/factory/boardFilters';
import type { BoardFilterState } from '../domains/factory/boardFilters';
import { candidatePayload } from '../domains/factory/boardDrag';
import { cardMatchesSearch } from '../domains/factory/boardItems';
import { orderWorkItemsForStage } from '../domains/factory/boardOrder';
import type { BoardSort } from '../domains/factory/boardOrder';
import { boardSortFromParams, boardSortParams } from '../domains/factory/boardSort';
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
  return <BoardLayout kind="work" />;
}

export function ReviewBoardPage() {
  return <BoardLayout kind="review" />;
}

export function CustomBoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  return <BoardLayout kind={boardId ?? ''} />;
}

function BoardLayout({ kind }: { kind: string }) {
  const factory = useActiveFactory();
  const slots = useSidebarHeaderSlots();
  return (
    <PageLayout variant="fit" {...slots}>
      <Board factory={factory} kind={kind} />
    </PageLayout>
  );
}

function Board({ factory, kind }: { factory: FactoryProject; kind: BoardKind }) {
  const catalog = useBoardCatalog(factory.id);
  if (catalog.isPending) {
    return (
      <p role="status" className="p-4">
        Loading boards…
      </p>
    );
  }
  if (catalog.isError) {
    return <EmptyState variant="fill" titleSlot={<span role="alert">Unable to load boards.</span>} />;
  }
  const definition = catalog.data.find(board => board.id === kind);
  if (!definition) {
    return (
      <EmptyState
        variant="fill"
        titleSlot={<span role="alert">Board unavailable: this board is not installed.</span>}
      />
    );
  }
  return <InstalledBoard factory={factory} definition={definition} />;
}

function InstalledBoard({ factory, definition }: { factory: FactoryProject; definition: InstalledBoardInfo }) {
  const kind = definition.id;
  const repository = factory.repositories[0];
  const review = kind === 'review';

  if (!repository) {
    return (
      <EmptyState
        variant="fill"
        as="h2"
        iconSlot={<GitBranch />}
        titleSlot={review ? 'Connect a repository to start reviewing' : 'Connect a repository to start intake'}
        descriptionSlot={
          review
            ? 'Link a repository in Repository settings. Its change requests will appear in Intake, ready to move through review.'
            : 'Link a repository in Repository settings. Its issues will appear in Intake, ready to move through planning and build.'
        }
        actionSlot={
          <Link to={settingsSectionPath(factory.id, 'repositories')} className={buttonVariants({ variant: 'primary' })}>
            Open Repository settings
          </Link>
        }
      />
    );
  }

  return <BoardContent factory={factory} repository={repository} kind={kind} definition={definition} />;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const targetItemId = searchParams.get('item') || undefined;
  const targetCommentId = targetItemId !== undefined ? (searchParams.get('comment') ?? undefined) : undefined;
  const filters = boardFiltersFromParams(searchParams, kind);

  const auth = useFactoryAuth();
  const sort = boardSortFromParams(searchParams, auth.data?.user?.userId);
  const items = useBoardItems({ factoryProjectId, kind, currentUserId: auth.data?.user?.userId });
  const intake = useBoardIntake({
    factoryProjectId,
    repository,
    definition,
    knownSourceKeys: items.knownSourceKeys,
    elsewhereSourceKeys: items.elsewhereSourceKeys,
  });
  const runs = useBoardRuns({ factoryProjectId, refetchItems: items.refetch });
  const relatedItemsFor = relatedWorkItemIndex(items.all);
  const sessionStatuses = useItemSessionStatuses({
    factoryProjectId,
    projectRepositoryId: repository.projectRepositoryId,
    items: items.all,
  });
  const decisions = useBoardDecisions(factoryProjectId);
  const composer = useBoardComposer(factoryProjectId, definition, auth.data?.user?.userId);
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
      candidateMatchesRelevance(candidate, filters.participantId, filters.relevanceTypes) &&
      candidateMatchesLabels(candidate, filters.labels) &&
      cardMatchesSearch(candidate, filters.search),
  );
  const setFilters = (next: BoardFilterState) => {
    const params = boardFilterParams(searchParams, next, kind);
    clearOpenCard(params);
    setSearchParams(params, { replace: true });
  };
  const setSort = (next: BoardSort) => {
    setSearchParams(boardSortParams(searchParams, next), { replace: true });
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
      if (stage !== definition.initialPhase || review || item.source === 'manual') return true;
      if (intake.active === 'github') return item.source === 'github-issue';
      if (intake.active === 'gitlab') return item.source === 'gitlab-issue';
      if (intake.active === 'linear') return item.source === 'linear-issue';
      if (intake.active === 'jira') return item.source === 'jira-issue';
      if (intake.active === 'incidentio') return item.source === 'incidentio-follow-up';
      return false;
    });
  const workItemsForStage = (stage: (typeof stages)[number]['id']) =>
    orderWorkItemsForStage(
      unfilteredWorkItemsForStage(stage).filter(item => {
        const liveCandidate = item.sourceKey ? participantCandidateBySourceKey.get(item.sourceKey) : undefined;
        return (
          workItemMatchesRelevance(item, activityPage, filters.participantId, filters.relevanceTypes, liveCandidate) &&
          workItemMatchesLabels(item, filters.labels, liveCandidate) &&
          cardMatchesSearch(item, filters.search)
        );
      }),
      stage,
      sort,
      auth.data?.user?.userId,
    );
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
  const anyFilterActive = boardFiltersActive(filters, kind);
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {mutationError !== undefined && (
        <div className="shrink-0 p-4 pb-0">
          <Notice variant="destructive">
            {mutationError instanceof Error ? mutationError.message : 'Board action failed'}
          </Notice>
        </div>
      )}
      <div className="[container-type:inline-size] m-px min-h-0 flex-1 overflow-auto overscroll-x-contain rounded-[calc(var(--studio-frame-radius,1.5rem)-1px)] [scrollbar-gutter:stable] lg:overscroll-x-auto">
        <div className="flex min-h-full w-max min-w-full flex-col gap-3">
          <div className="from-background via-background z-20 flex flex-col gap-3 bg-linear-to-b via-[calc(100%-1rem)] to-transparent pb-4 max-lg:contents lg:sticky lg:top-0">
            <div className="sticky left-0 flex w-[100cqw] flex-wrap items-center gap-x-4 gap-y-3 px-4 pt-4">
              <div
                role="group"
                aria-label="Board view controls"
                className="flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-2 gap-y-3 lg:basis-auto"
              >
                <BoardFilters
                  kind={kind}
                  participants={participants}
                  availableLabels={availableLabels}
                  currentUserId={auth.data?.user?.userId}
                  filters={filters}
                  onFiltersChange={setFilters}
                />
                <BoardSortControl value={sort} currentUserId={auth.data?.user?.userId} onChange={setSort} />
              </div>
              {builtin && (
                <div className="ml-auto shrink-0">
                  <BoardAutomationSettings
                    factoryProjectId={factoryProjectId}
                    autoRunEnabled={factory.autoRunEnabled ?? false}
                    autoApprovePlans={factory.autoApprovePlans ?? false}
                  />
                </div>
              )}
            </div>
            <div className="from-background via-background sticky top-0 z-20 flex items-start gap-2 via-[calc(100%-0.75rem)] to-transparent px-4 max-lg:bg-linear-to-b max-lg:pb-3 lg:gap-3">
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
            <div role="group" aria-label="Board columns" className="flex flex-1 items-stretch gap-2 px-4 pb-4 lg:gap-3">
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
                      )}
                    />
                    {stageWorkItems.length > 0 && stageCandidates.length > 0 ? (
                      <div role="separator" aria-label="New candidates" className="flex items-center gap-2 py-1">
                        <span aria-hidden className="bg-border h-px flex-1" />
                        <span className="text-meta text-muted-foreground">New candidates</span>
                        <span aria-hidden className="bg-border h-px flex-1" />
                      </div>
                    ) : null}
                    <ColumnReveal
                      items={stageCandidates}
                      renderItem={candidate => (
                        <CandidateCard
                          key={candidate.sourceKey}
                          candidate={candidate}
                          projectRepositoryId={repository.projectRepositoryId}
                          factoryProjectId={factoryProjectId}
                          onRun={(move, prompt) =>
                            items.handleDrop(candidatePayload(candidate, prompt), move.stage, 'card_action')
                          }
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
            'rounded-full border px-2.5 py-0.5 text-meta transition',
            active === source.id
              ? 'border-accent1 bg-fill text-foreground'
              : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {source.label}
        </button>
      ))}
    </div>
  );
}
