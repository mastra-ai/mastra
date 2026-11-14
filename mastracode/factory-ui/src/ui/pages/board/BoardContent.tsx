import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import type { ProviderPerson } from '@mastra/factory/work-items/card-people';
import { boardLoop } from '../../domains/factory/boardFlow';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useDebouncedValue } from '@mastra/playground-ui/hooks/use-debounced-value';
import { useMemo, useState } from 'react';
import type { InstalledBoardInfo } from '../../../api/types';

import { useRecentAuditEvents } from '../../../hooks/useAuditEvents';
import { useFactoryAuth } from '../../../hooks/useFactoryAuth';
import { useGithubStatusQuery } from '../../../hooks/useGithubStatus';
import { useRunQueue } from '../../../hooks/useFactoryDecisions';
import {
  useBoardPhasesQuery,
  useSidebarWorkItemsQuery,
  useWorkItemFilterOptionsQuery,
} from '../../../hooks/useWorkItems';
import { shownBoardPhases } from '../../domains/factory/boardPhases';
import type { ShownPhase } from '../../domains/factory/boardPhases';
import { boardPhasesRequest, deeperPhaseWindow, isCardId } from '../../domains/factory/boardPhasesRequest';
import { boardLoadingStages } from '../../domains/factory/boardStages';
import type { BoardKind } from '../../domains/factory/boardStages';
import { ConfigureBoardButton } from '../../domains/boardConfig/components/ConfigureBoardButton';
import { RunQueueIndicator } from '../../domains/factory/components/RunQueueIndicator';
import { RepositoryPickerDialog } from '../../domains/factory/components/RepositoryPickerDialog';
import { BoardItemsSkeleton } from '../../domains/factory/components/BoardItemsSkeleton';
import { BoardStageCards } from '../../domains/factory/components/BoardStageCards';
import { BoardEmptyStateActions } from '../../domains/factory/components/BoardEmptyStateActions';
import { BoardStageCreateButton } from '../../domains/factory/components/BoardStageCreateButton';
import { BoardViewControls } from '../../domains/factory/components/BoardViewControls';
import { LoadMoreSentinel } from '../../domains/factory/components/LoadMoreSentinel';
import { useBoardComposer } from '../../domains/factory/hooks/useBoardComposer';
import { useBoardDeepLink } from '../../domains/factory/hooks/useBoardDeepLink';
import { useCollapsedStages } from '../../domains/factory/hooks/useCollapsedStages';
import { useBoardDecisions } from '../../domains/factory/hooks/useBoardDecisions';
import { useBoardIntakeSetup } from '../../domains/factory/hooks/useBoardIntakeSetup';
import { useItemSessionStatuses } from '../../domains/factory/hooks/useItemSessionStatuses';
import { useBoardItems } from '../../domains/factory/hooks/useBoardItems';
import { useBoardRuns } from '../../domains/factory/hooks/useBoardRuns';
import { useOpenCardState } from '../../domains/factory/hooks/useOpenCardState';
import { useRepositoryChoice } from '../../domains/factory/hooks/useRepositoryChoice';
import { boardParticipants, boardPersonIdentity, withPeopleUnfolded } from '../../domains/factory/boardPeople';
import { boardFiltersActive } from '../../domains/factory/boardFilters';
import { useBoardView } from '../../domains/factory/hooks/useBoardView';
import { BUSY_CARD_MOVE_REFUSAL, canMoveTo } from '../../domains/factory/boardCardState';
import type { DragPayload } from '../../domains/factory/boardDrag';
import type { WorkItem } from '../../domains/factory/services/workItems';
import { relatedWorkItemIndex } from '../../domains/factory/services/relationships';
import type { FactoryProject, LinkedRepositoryPayload } from '../../domains/workspaces/services/github';

import { VirtualBoardItems } from '../../domains/factory/components/VirtualBoardItems';
import { WorkItemCard } from '../../domains/factory/components/WorkItemCard';
import { InlineWorkItemComposer } from '../../domains/factory/components/InlineWorkItemComposer';
import { BoardStages } from './BoardStages';
import { cardProjectRepositoryId } from '../../domains/factory/boardRepository';

const NO_CARDS: WorkItem[] = [];
const NO_WINDOWS: Readonly<Record<string, number>> = {};
const NO_SESSIONS: readonly string[] = [];
const NO_ACTORS: string[] = [];
const NO_PEOPLE: readonly ProviderPerson[] = [];
const NO_LABELS: readonly string[] = [];
const NO_PHASE: ShownPhase = { cards: NO_CARDS, total: 0, listed: 0, listedAll: true };

// One item can sit in several stages; each copy is its own card.
const workItemCardKey = (stageId: string, itemId: string) => `${stageId}/${itemId}`;

/** The card a row's key names: a card id holds no `/`. */
function keyedCardId(key: string | undefined): string | undefined {
  const id = key?.slice(key.lastIndexOf('/') + 1);
  return id !== undefined && isCardId(id) ? id : undefined;
}

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
  // A board with a pull request loop runs Factory's automation; the default board keeps its own column icons.
  const loop = boardLoop(definition);
  const runsLoop = loop !== undefined;
  // A board that reviews pull requests but builds nothing (the retired Review board a project still
  // uses) takes no new cards: its cards come from pull requests.
  const pullRequestsOnly = loop?.pullRequestReview !== undefined && loop.build === undefined;
  const stages = definition.phases.map(phase => ({ ...phase, label: phase.title }));
  const auth = useFactoryAuth();
  const currentUserId = auth.data?.user?.userId;
  const githubStatus = useGithubStatusQuery();
  const personId = boardPersonIdentity(currentUserId, githubStatus.data?.userGithubUsername);
  const reviewsPullRequests = boardLoop(definition)?.pullRequestReview !== undefined;
  const boardView = useBoardView({ factoryProjectId, kind, reviewsPullRequests, currentUserId, personId });
  const { searchParams, filters, sort, layout } = boardView;
  const targetItemId = searchParams.get('item') || undefined;
  // The server is asked once typing pauses. Clearing the box goes back to the empty search at once.
  const settledSearch = useDebouncedValue(boardView.search, 150);
  const storedFilters = withPeopleUnfolded(filters, personId);
  const view = boardPhasesRequest({
    board: kind,
    sort,
    search: boardView.search.trim() === '' ? '' : settledSearch,
    filters: storedFilters,
    windows: NO_WINDOWS,
    item: targetItemId,
  });
  // How deep each phase was scrolled is forgotten when the view changes: its phases start over.
  const viewKey = JSON.stringify([view.sort, view.q, view.filters]);
  const [deepened, setDeepened] = useState({ viewKey, windows: NO_WINDOWS });
  const windows = deepened.viewKey === viewKey ? deepened.windows : NO_WINDOWS;
  const openCard = useOpenCardState();
  const phasesRead = useBoardPhasesQuery(factoryProjectId, { ...view, windows }, keyedCardId(openCard.openKey));
  const snapshot = phasesRead.data;
  const cards = snapshot?.workItems ?? NO_CARDS;
  const sessionCards = useSidebarWorkItemsQuery(factoryProjectId).data?.workItems ?? NO_CARDS;

  const items = useBoardItems({ factoryProjectId, kind, currentUserId, items: [...cards, ...sessionCards] });
  const repositoryChoice = useRepositoryChoice(factory, definition);
  const dropWithRepository = (
    payload: DragPayload,
    stage: Parameters<typeof items.handleDrop>[1],
    cause = 'board_drag',
  ) => {
    if (payload.fromStage === stage) return;
    const toPhaseKind = definition.phases.find(phase => phase.id === stage)?.kind;
    if (!canMoveTo(payload.ownerKind, toPhaseKind)) {
      toast.error(BUSY_CARD_MOVE_REFUSAL);
      return;
    }
    const card = cards.find(item => item.id === payload.id);
    if (!card) return;
    void repositoryChoice.choose(
      card.source,
      { ...card.metadata, ...card.workItem?.metadata },
      stage,
      slug => items.move(payload.id, stage, { cause, repositorySlug: slug }),
      () => items.handleDrop(payload, stage, cause),
    );
  };
  const intake = useBoardIntakeSetup({ factoryProjectId, repositories: factory.repositories, definition });
  const runs = useBoardRuns({ factoryProjectId });
  const relatedItemsFor = useMemo(() => relatedWorkItemIndex(cards), [cards]);
  const sessionStatuses = useItemSessionStatuses({
    factoryProjectId,
    projectRepositoryId: repository.projectRepositoryId,
    items: cards,
    parkedSessionIds: snapshot?.parkedSessionIds ?? NO_SESSIONS,
  });
  const decisions = useBoardDecisions(factoryProjectId);
  const runQueue = useRunQueue(factoryProjectId);
  // Keyed by card, not by the card's board decision: the board reads the newest
  // decisions while the queue lists the oldest waiters, so a waiting run can be
  // missing from the board's page. A card's first entry is its next run.
  const queuePositions = useMemo(() => {
    const positions = new Map<string, number>();
    for (const run of runQueue.data?.queued ?? []) {
      if (run.workItem && !positions.has(run.workItem.id)) positions.set(run.workItem.id, run.position);
    }
    return positions;
  }, [runQueue.data]);
  const composer = useBoardComposer(factoryProjectId, definition, currentUserId);
  const filterOptions = useWorkItemFilterOptionsQuery(factoryProjectId).data;
  const activity = useRecentAuditEvents(
    factoryProjectId,
    `board-${kind}-activity`,
    200,
    filterOptions?.actorIds ?? NO_ACTORS,
  );
  const activityPage = activity.data;
  const participants = boardParticipants({
    people: filterOptions?.people ?? NO_PEOPLE,
    activityPage,
    currentUser: auth.data?.user,
    personId,
  });
  const availableLabels = filterOptions?.labels ?? NO_LABELS;
  const shownPhases = useMemo(() => shownBoardPhases(snapshot, definition.phases), [snapshot, definition.phases]);
  const targetStages = targetItemId
    ? stages
        .filter(stage => shownPhases.get(stage.id)?.cards.some(item => item.id === targetItemId))
        .map(stage => stage.id)
    : [];
  const targetListed = targetStages.length > 0;
  const viewAnswered = phasesRead.data !== undefined && !phasesRead.isPlaceholderData;
  const targetReady = !phasesRead.isPending && (!targetItemId || targetListed);
  const loadingStages = boardLoadingStages({
    board: definition,
    stages,
    itemsPending: phasesRead.isPending,
    intakePending: intake.isPending,
  });
  const registerDeepLinkedCard = useBoardDeepLink({
    boardKey: `${factoryProjectId}:${kind}`,
    targetItemId,
    targetReady,
  });
  const collapsedStages = useCollapsedStages(
    targetItemId && targetListed ? { itemId: targetItemId, stages: targetStages } : undefined,
  );

  if (phasesRead.isError) {
    return (
      <div className="p-4">
        <Notice
          variant="destructive"
          className="max-w-xl"
          action={<Notice.Button onClick={() => void phasesRead.refetch()}>Retry</Notice.Button>}
        >
          {phasesRead.error instanceof Error ? phasesRead.error.message : 'Failed to load the board'}
        </Notice>
      </div>
    );
  }

  const mutationError = runs.error ?? decisions.error ?? items.mutationError;
  const totalTaskCount = snapshot?.matchingTotal ?? 0;
  const unfilteredTaskCount = snapshot?.boardTotal ?? 0;
  const anyFilterActive = boardFiltersActive(filters) || view.q !== '';
  // The phases of the view before a change stay up until the new ones answer: they say nothing of it.
  const filtersExcludeAll = viewAnswered && anyFilterActive && totalTaskCount === 0 && unfilteredTaskCount > 0;
  const intakeSetup = intake.fed ? undefined : intake.unrouted ? 'route' : 'source';

  const stageViews = stages.map(stage => {
    const isInitialPhase = stage.id === definition.initialPhase;
    const loading = loadingStages.has(stage.id);
    const shown = shownPhases.get(stage.id) ?? NO_PHASE;
    const taskCount = shown.total;
    const composerOpen = composer.stage === stage.id;
    // No card is created by hand on the retired Review board: its cards come from pull requests.
    const canCreate =
      !pullRequestsOnly &&
      !phasesRead.isPending &&
      stage.kind !== 'terminal' &&
      (composer.stage === undefined || composerOpen);
    const stageIntakeSetup = isInitialPhase ? intakeSetup : undefined;
    const showEmptyStateActions = isInitialPhase && (filtersExcludeAll || canCreate || Boolean(stageIntakeSetup));
    const collapsed = runsLoop && !isInitialPhase && !loading && !composerOpen && taskCount === 0;
    return {
      stage,
      phaseKind: definition.id === DEFAULT_BOARD_ID ? undefined : stage.kind,
      exitTool: stage.exitTool,
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
          loading={loading}
          taskCount={taskCount}
          intakeSetup={intakeSetup}
          intakeFailure={isInitialPhase ? intake.routesFailure : undefined}
          filtersExcludeAll={filtersExcludeAll}
          emptyStateActions={
            showEmptyStateActions && (
              <BoardEmptyStateActions
                factoryId={factoryProjectId}
                intakeSetup={stageIntakeSetup}
                onCreate={canCreate ? () => composer.open(stage.id) : undefined}
                onClearFilters={filtersExcludeAll ? boardView.clearFilters : undefined}
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
            items={shown.cards}
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
                queuePosition={queuePositions.get(item.id)}
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
                    { ...item.metadata, ...item.workItem?.metadata },
                    toStage,
                    slug => items.move(item.id, toStage, { repositorySlug: slug }),
                    () => items.move(item.id, toStage),
                  )
                }
                onRemove={() => items.remove(item.id)}
              />
            )}
          />
          <LoadMoreSentinel
            hasNextPage={!shown.listedAll}
            // A phase waits for its own deeper window, and every phase for a view not read yet.
            // Another phase's end coming into view meanwhile lists that one deeper too.
            isFetchingNextPage={
              phasesRead.isPlaceholderData && (windows === NO_WINDOWS || (windows[stage.id] ?? 0) > shown.listed)
            }
            onLoadMore={() =>
              // From the windows as they stand: two ends coming into view together both list deeper.
              setDeepened(current => ({
                viewKey,
                windows: {
                  ...(current.viewKey === viewKey ? current.windows : NO_WINDOWS),
                  [stage.id]: deeperPhaseWindow(shown.listed),
                },
              }))
            }
            loaded={shown.listed}
            label="Load more cards"
            loadingIndicator={<BoardItemsSkeleton label="Loading more cards" rows={1} layout={layout} />}
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
        openCard={openCard}
        onDrop={dropWithRepository}
        toolbar={
          <BoardViewControls
            reviewsPullRequests={reviewsPullRequests}
            view={boardView}
            participants={participants}
            availableLabels={availableLabels}
            currentUserId={currentUserId}
            aside={
              <div className="flex items-center gap-2">
                <RunQueueIndicator factoryId={factoryProjectId} queue={runQueue.data} />
                <ConfigureBoardButton factoryId={factoryProjectId} boardId={definition.id} />
              </div>
            }
          />
        }
      />
    </div>
  );
}
