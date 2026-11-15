import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { boardIdOf, boardOf } from '../../factory/boardFlow';
import { CommandEmpty } from '@mastra/playground-ui/components/Command';
import {
  CommandPaletteBody,
  CommandPaletteFooter,
  CommandPaletteInput,
  CommandPaletteResults,
} from '@mastra/playground-ui/components/CommandPalette';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useState } from 'react';

import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { BUSY_CARD_MOVE_REFUSAL, boardCardState, canStartRun } from '../../factory/boardCardState';
import { currentItemStage, itemStageLabel } from '../../factory/boardStages';
import { cardMoves } from '../../factory/cardPrimaryAction';
import { useBoardItems } from '../../factory/hooks/useBoardItems';
import { useBoardRuns } from '../../factory/hooks/useBoardRuns';
import { useItemDecisions } from '../../factory/hooks/useBoardDecisions';
import { RepositoryPickerDialog } from '../../factory/components/RepositoryPickerDialog';
import { useGlobalSearchNavigation } from '../hooks/useGlobalSearchNavigation';
import { useGlobalSearchSessions } from '../hooks/useGlobalSearchSessions';
import { useGlobalSearchWorkItems } from '../hooks/useGlobalSearchWorkItems';
import { createSessionSearchGroups, createWorkItemSearchResults } from '../services/searchResults';
import {
  createGlobalSearchScopeCounts,
  isSessionScope,
  isWorkItemScope,
  scopeIncludes,
} from '../services/searchScopes';
import type { GlobalSearchScope } from '../services/searchScopes';
import { GlobalSearchFactoriesResults } from './GlobalSearchFactoriesResults';
import { GlobalSearchNavigationResults } from './GlobalSearchNavigationResults';
import { GlobalSearchRail } from './GlobalSearchRail';
import { GlobalSearchSessionResults } from './GlobalSearchSessionResults';
import { GlobalSearchSessionsStatus } from './GlobalSearchSessionsStatus';
import { GlobalSearchWorkItemResults } from './GlobalSearchWorkItemResults';
import { GlobalSearchWorkItemsStatus } from './GlobalSearchWorkItemsStatus';

export function FactoryGlobalSearchContent({ factoryId, closeSearch }: { factoryId: string; closeSearch: () => void }) {
  const currentUserId = useFactoryAuth().data?.user?.userId;
  const factories = useFactoriesQuery().data ?? [];
  const activeFactory = factories.find(factory => factory.id === factoryId);
  const repositoryIds = activeFactory?.repositories.map(repository => repository.projectRepositoryId) ?? [];
  const searchableFactoryId = repositoryIds.length > 0 ? factoryId : undefined;
  const sessions = useGlobalSearchSessions(searchableFactoryId);
  const [query, setQuery] = useState('');
  const workItems = useGlobalSearchWorkItems(searchableFactoryId, query);
  const toastFailureAfterPaletteCloses = (message: string) => toast.error(message);
  const catalog = useBoardCatalog(searchableFactoryId);
  const workBoard = useBoardItems({
    factoryProjectId: searchableFactoryId,
    kind: boardIdOf({}),
    currentUserId,
    onFailure: toastFailureAfterPaletteCloses,
    items: workItems.loaded,
  });
  const runs = useBoardRuns({ factoryProjectId: factoryId });
  const { effectByItem } = useItemDecisions(searchableFactoryId);
  const { selectPath } = useGlobalSearchNavigation(closeSearch);
  const [activeScope, setActiveScope] = useState<GlobalSearchScope>('all');

  const sessionGroups = createSessionSearchGroups({
    factoryId,
    repositories: sessions.repositories,
    workItems: workItems.withSessions,
    boards: catalog.data,
  });
  const unstartedItems = createWorkItemSearchResults({
    factoryId,
    workItems: workItems.unstarted,
    boards: catalog.data,
  });
  const counts = createGlobalSearchScopeCounts({
    work: sessionGroups.work.length,
    review: sessionGroups.review.length,
    items: workItems.count,
    user: sessionGroups.user.length,
    factories: factories.length,
  });
  const sessionsPending = sessions.pending || workItems.pending;
  const hasRepositories = repositoryIds.length > 0;

  return (
    <>
      <CommandPaletteInput
        autoFocus
        onValueChange={setQuery}
        placeholder="Search sessions, reviews, #issues, pages, and Factories"
        rightSlot={<Kbd>Esc</Kbd>}
      />

      {runs.repositorySelection && (
        <RepositoryPickerDialog
          repositories={runs.repositoryChoices}
          onClose={runs.closeRepositorySelection}
          onSelect={async repository => {
            await runs.selectRepository(repository);
            closeSearch();
          }}
        />
      )}
      <CommandPaletteBody>
        <GlobalSearchRail activeScope={activeScope} counts={counts} onScopeChange={setActiveScope} />
        <CommandPaletteResults aria-label="Search results" footer={<CommandPaletteFooter label="Factory search" />}>
          {!sessionsPending && <CommandEmpty>No matching results.</CommandEmpty>}
          {scopeIncludes(activeScope, 'navigation') && (
            <GlobalSearchNavigationResults factoryId={factoryId} onSelect={selectPath} />
          )}
          {scopeIncludes(activeScope, 'work') && (
            <GlobalSearchSessionResults title="Work Sessions" results={sessionGroups.work} onSelect={selectPath} />
          )}
          {scopeIncludes(activeScope, 'review') && (
            <GlobalSearchSessionResults title="Review Sessions" results={sessionGroups.review} onSelect={selectPath} />
          )}
          {scopeIncludes(activeScope, 'items') && (
            <GlobalSearchWorkItemResults
              results={unstartedItems}
              onSelect={result => {
                const item = result.item;
                const board = workBoard;
                const definition = boardOf(catalog.data, item);
                const movingTo = board.evaluatingStages.get(item.id);
                const { owner } = boardCardState({
                  decision: effectByItem.get(item.id),
                  moving:
                    movingTo === undefined
                      ? undefined
                      : { stage: movingTo, label: itemStageLabel(item, movingTo, definition) },
                  preparing: runs.preparingFor(item.id),
                });
                if (!canStartRun(owner.kind)) {
                  closeSearch();
                  toast.error(BUSY_CARD_MOVE_REFUSAL);
                  return;
                }
                // Moves read from the phase the card sits in (its furthest, as its label shows), not its board's first.
                const stage = currentItemStage(item, definition);
                const [move] = definition && stage !== undefined ? cardMoves(item, stage, definition) : [];
                if (move) {
                  closeSearch();
                  board.move(item.id, move.stage);
                  return;
                }
                void runs
                  .openOrCreateSession(item)
                  .then(result => {
                    if (result !== 'repository-selection-required') closeSearch();
                  })
                  .catch(error =>
                    toast.error(error instanceof Error ? error.message : 'The session could not be started.'),
                  );
              }}
            />
          )}
          {scopeIncludes(activeScope, 'user') && (
            <GlobalSearchSessionResults title="User Sessions" results={sessionGroups.user} onSelect={selectPath} />
          )}
          {isSessionScope(activeScope) && hasRepositories && (
            <GlobalSearchSessionsStatus pending={sessionsPending} failed={sessions.failed} onRetry={sessions.retry} />
          )}
          {isWorkItemScope(activeScope) && hasRepositories && (
            <GlobalSearchWorkItemsStatus failed={workItems.failed} onRetry={workItems.retry} />
          )}
          {scopeIncludes(activeScope, 'factories') && (
            <GlobalSearchFactoriesResults factories={factories} activeFactoryId={factoryId} onSelect={selectPath} />
          )}
        </CommandPaletteResults>
      </CommandPaletteBody>
    </>
  );
}
