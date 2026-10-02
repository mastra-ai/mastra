import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { cn } from '@mastra/playground-ui/utils/cn';
import { GitBranch, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import type { InstalledBoardInfo } from '../../api/types';
import { useBoardCatalog } from '../../hooks/useBoardCatalog';

import { useRecentAuditEvents } from '../../hooks/useAuditEvents';
import { useFactoryAuth } from '../../hooks/useFactoryAuth';
import { useIntakeConfigQuery } from '../../hooks/useIntakeConfig';
import { INTAKE_SOURCES, stageContentCount } from '../domains/factory/boardCandidates';
import type { IntakeSource } from '../domains/factory/boardCandidates';
import { boardLoadingStages, itemAppearsInStage } from '../domains/factory/boardStages';
import type { BoardKind } from '../domains/factory/boardStages';
import { BoardAutomationSettings } from '../domains/factory/components/BoardAutomationSettings';
import { BoardTooltipDelay } from '../domains/factory/components/BoardCardParts';
import { RepositoryPickerDialog } from '../domains/factory/components/RepositoryPickerDialog';
import { BoardColumn, BoardColumnHeader } from '../domains/factory/components/BoardColumn';
import { BoardColumnEmptyState } from '../domains/factory/components/BoardColumnEmptyState';
import { BoardList, BoardListGroup } from '../domains/factory/components/BoardList';
import { ColumnReveal } from '../domains/factory/components/ColumnReveal';
import { BoardViewControls } from '../domains/factory/components/BoardViewControls';
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
import {
  boardLabels,
  boardParticipants,
  candidateMatchesLabels,
  candidateMatchesRelevance,
  workItemMatchesLabels,
  workItemMatchesRelevance,
} from '../domains/factory/boardRelevance';
import { boardFiltersActive } from '../domains/factory/boardFilters';
import { clearOpenCard, useBoardView } from '../domains/factory/hooks/useBoardView';
import { candidatePayload } from '../domains/factory/boardDrag';
import type { DragPayload } from '../domains/factory/boardDrag';
import { cardMatchesSearch } from '../domains/factory/boardItems';
import { orderWorkItemsForStage } from '../domains/factory/boardOrder';
import { relatedWorkItemIndex } from '../domains/factory/services/relationships';
import { workItemHumanActorIds } from '../domains/factory/workItemActivity';
import type { FactoryProject, LinkedRepositoryPayload } from '../domains/workspaces/services/github';
import { SkeletonRows } from '../ui/SkeletonRows';
import { settingsSectionPath } from '../domains/settings/settingsSections';
import { Txt } from '@mastra/playground-ui/components/Txt';

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
  const iconKind = (stage: (typeof stages)[number]) => (builtin ? undefined : stage.kind);
  const auth = useFactoryAuth();
  const currentUserId = auth.data?.user?.userId;
  const view = useBoardView({ factoryProjectId, kind, currentUserId });
  const { searchParams, setSearchParams, filters, sort, layout } = view;
  const targetItemId = searchParams.get('item') || undefined;
  const targetCommentId = targetItemId !== undefined ? (searchParams.get('comment') ?? undefined) : undefined;

  const items = useBoardItems({ factoryProjectId, kind, currentUserId });
  const intakeConfig = useIntakeConfigQuery();
  const [repositoryAction, setRepositoryAction] = useState<((slug: string) => void) | null>(null);
  const chooseRepository = (
    source: string,
    metadata: Record<string, unknown> | null,
    stage: string,
    onSelect: (slug: string) => void,
    onResolved: () => void,
  ) => {
    const mappedSlug =
      source === 'linear-issue' && typeof metadata?.linearProjectId === 'string'
        ? intakeConfig.data?.linear.repositoryByLinearProject?.[metadata.linearProjectId]
        : undefined;
    const knownSlug = typeof metadata?.repository === 'string' ? metadata.repository : mappedSlug;
    if (
      factory.repositories.length > 1 &&
      definition.phases.find(phase => phase.id === stage)?.kind === 'working' &&
      !factory.repositories.some(repo => repo.slug === knownSlug)
    ) {
      setRepositoryAction(() => onSelect);
      return;
    }
    onResolved();
  };
  const dropWithRepository = (
    payload: DragPayload,
    stage: Parameters<typeof items.handleDrop>[1],
    cause = 'board_drag',
  ) => {
    if (payload.kind === 'work-item' && payload.fromStage === stage) return;
    const item = payload.kind === 'work-item' ? items.all.find(candidate => candidate.id === payload.id) : undefined;
    const source = payload.kind === 'candidate' ? payload.candidate.source : item?.source;
    const metadata = payload.kind === 'candidate' ? payload.candidate.metadata : item?.metadata;
    if (!source) return;
    chooseRepository(
      source,
      metadata ?? null,
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
  const filteredCandidates = intake.candidates.filter(
    candidate =>
      candidateMatchesRelevance(candidate, filters.participantIds, filters.relevanceTypes) &&
      candidateMatchesLabels(candidate, filters.labels) &&
      cardMatchesSearch(candidate, filters.search),
  );
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
          workItemMatchesRelevance(item, activityPage, filters.participantIds, filters.relevanceTypes, liveCandidate) &&
          workItemMatchesLabels(item, filters.labels, liveCandidate) &&
          cardMatchesSearch(item, filters.search)
        );
      }),
      stage,
      sort,
      currentUserId,
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
        builtin &&
        stage.id !== definition.initialPhase &&
        !loading &&
        !composerOpen &&
        !feedFailed &&
        !columnFeed?.hasNextPage &&
        taskCount === 0,
    };
  });
  type StageView = (typeof stageViews)[number];

  const stageCreateButton = ({ stage, loading, composerOpen }: StageView) =>
    !review && !loading && stage.kind !== 'terminal' && (composer.stage === undefined || composerOpen) ? (
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
    ) : undefined;

  const stageExtras = ({ stage }: StageView) =>
    stage.id === definition.initialPhase && intake.showSwitch ? (
      <IntakeSourceSwitch available={intake.available} active={intake.active} onSelect={setIntakeSource} />
    ) : undefined;

  const stageHeader = (stageView: StageView) => (
    <BoardColumnHeader
      phaseKind={iconKind(stageView.stage)}
      key={stageView.stage.id}
      stage={stageView.stage.id}
      label={stageView.stage.label}
      taskCount={stageView.taskCount}
      totalTaskCount={totalTaskCount}
      loading={stageView.loading}
      collapsed={stageView.collapsed}
      headerAction={stageCreateButton(stageView)}
      headerExtras={stageExtras(stageView)}
    />
  );

  const skeletonRowClassName = layout === 'board' ? 'h-24 w-full' : 'h-10 w-full';

  const stageCards = ({
    stage,
    loading,
    stageWorkItems,
    stageCandidates,
    taskCount,
    composerOpen,
    columnFeed,
    feedFailed,
  }: StageView) => (
    <>
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
            layout={layout}
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
            onMove={toStage =>
              chooseRepository(
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
      {stageWorkItems.length > 0 && stageCandidates.length > 0 ? (
        <div role="separator" aria-label="New candidates" className="flex items-center gap-2 py-1">
          <span aria-hidden className="bg-border h-px flex-1" />
          <Txt as="span" variant="meta" tone="muted">
            New candidates
          </Txt>
          <span aria-hidden className="bg-border h-px flex-1" />
        </div>
      ) : null}
      <ColumnReveal
        items={stageCandidates}
        renderItem={candidate => (
          <CandidateCard
            key={candidate.sourceKey}
            layout={layout}
            candidate={candidate}
            projectRepositoryId={repository.projectRepositoryId}
            factoryProjectId={factoryProjectId}
            onRun={(move, prompt) => dropWithRepository(candidatePayload(candidate, prompt), move.stage, 'card_action')}
          />
        )}
      />
      {loading && <SkeletonRows label={`Loading ${stage.label} column`} rows={3} rowClassName={skeletonRowClassName} />}
      {!loading && !composerOpen && taskCount === 0 && !feedFailed && (
        <BoardColumnEmptyState
          stage={stage.id}
          kind={kind}
          hasIntakeSource={intake.active !== undefined}
          filtersExcludeAll={filtersExcludeAll}
          alreadyMaterialized={stage.id === definition.initialPhase ? intake.alreadyMaterialized : 0}
          layout={layout}
        />
      )}
      {columnFeed && <IntakeFeedNotice source={intake.active} feed={columnFeed} />}
      {columnFeed && (
        <IntakeColumnExtras
          feed={columnFeed}
          currentColumnLength={taskCount}
          skeletonRowClassName={skeletonRowClassName}
        />
      )}
    </>
  );

  const stageColumn = (stageView: StageView) => (
    <BoardColumn
      key={stageView.stage.id}
      stage={stageView.stage.id}
      label={stageView.stage.label}
      collapsed={stageView.collapsed}
      onDrop={dropWithRepository}
    >
      {stageCards(stageView)}
    </BoardColumn>
  );

  const stageGroup = (stageView: StageView) => (
    <BoardListGroup
      key={stageView.stage.id}
      stage={stageView.stage.id}
      label={stageView.stage.label}
      phaseKind={iconKind(stageView.stage)}
      count={stageView.taskCount}
      loading={stageView.loading}
      action={stageCreateButton(stageView)}
      extras={stageExtras(stageView)}
      onDrop={dropWithRepository}
    >
      {stageCards(stageView)}
    </BoardListGroup>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {runs.repositorySelection && (
        <RepositoryPickerDialog
          repositories={runs.repositories}
          onClose={runs.closeRepositorySelection}
          onSelect={runs.selectRepository}
        />
      )}
      {repositoryAction && (
        <RepositoryPickerDialog
          repositories={factory.repositories}
          onClose={() => setRepositoryAction(null)}
          onSelect={selectedRepository => {
            const action = repositoryAction;
            setRepositoryAction(null);
            action(selectedRepository.slug);
          }}
        />
      )}
      {mutationError !== undefined && (
        <div className="shrink-0 p-4 pb-0">
          <Notice variant="destructive">
            {mutationError instanceof Error ? mutationError.message : 'Board action failed'}
          </Notice>
        </div>
      )}
      <div className="[container-type:inline-size] m-px min-h-0 flex-1 overflow-auto overscroll-x-contain rounded-[calc(var(--studio-frame-radius,1.5rem)-1px)] [scrollbar-gutter:stable] lg:overscroll-x-auto">
        <div className={cn('flex min-h-full min-w-full flex-col gap-3', layout === 'board' ? 'w-max' : 'w-full')}>
          <div className="from-background via-background z-20 flex flex-col gap-3 bg-linear-to-b via-[calc(100%-1rem)] to-transparent pb-4 max-lg:contents lg:sticky lg:top-0">
            <div className="sticky left-0 flex w-[100cqw] px-4 pt-4">
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
                    />
                  )
                }
              />
            </div>
            {layout === 'board' && (
              <div className="from-background via-background sticky top-0 z-20 flex items-start gap-2 via-[calc(100%-0.75rem)] to-transparent px-4 max-lg:bg-linear-to-b max-lg:pb-3 lg:gap-3">
                {stageViews.map(stageHeader)}
              </div>
            )}
          </div>
          <BoardTooltipDelay>
            {layout === 'board' ? (
              <div
                role="group"
                aria-label="Board columns"
                className="flex flex-1 items-stretch gap-2 px-4 pb-4 lg:gap-3"
              >
                {stageViews.map(stageColumn)}
              </div>
            ) : (
              <div className="flex flex-1 flex-col px-4 pb-4">
                <BoardList>{stageViews.map(stageGroup)}</BoardList>
              </div>
            )}
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
              ? 'border-badge-green-indicator bg-fill text-foreground'
              : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {source.label}
        </button>
      ))}
    </div>
  );
}
