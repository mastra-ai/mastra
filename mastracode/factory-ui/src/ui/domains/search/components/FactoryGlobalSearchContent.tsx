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
import { candidatePayload } from '../../factory/boardDrag';
import { cardMoves } from '../../factory/cardPrimaryAction';
import { useBoardItems } from '../../factory/hooks/useBoardItems';
import { useBoardRuns } from '../../factory/hooks/useBoardRuns';
import { useGlobalSearchIntake } from '../hooks/useGlobalSearchIntake';
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
  const factories = useFactoriesQuery().data ?? [];
  const activeFactory = factories.find(factory => factory.id === factoryId);
  const repositoryIds = activeFactory?.repositories.map(repository => repository.projectRepositoryId) ?? [];
  const sessions = useGlobalSearchSessions(repositoryIds);
  const searchableFactoryId = repositoryIds.length > 0 ? factoryId : undefined;
  const workItems = useGlobalSearchWorkItems(searchableFactoryId);
  // Both boards read `repositories[0]`, so that is the repository whose intake feeds are searchable.
  const projectRepositoryId = activeFactory?.repositories[0]?.projectRepositoryId;
  const intake = useGlobalSearchIntake(projectRepositoryId);
  // The palette closes on select, so a failed move has no card left to carry its reason.
  const board = useBoardItems({
    factoryProjectId: searchableFactoryId,
    kind: 'work',
    onFailure: message => toast.error(message),
  });
  const runs = useBoardRuns({ factoryProjectId: factoryId, refetchItems: workItems.refetch });
  const { selectPath } = useGlobalSearchNavigation(closeSearch);
  const [activeScope, setActiveScope] = useState<GlobalSearchScope>('all');

  const sessionGroups = createSessionSearchGroups({
    factoryId,
    repositories: sessions.repositories,
    workItems: workItems.items,
  });
  const unstartedItems = createWorkItemSearchResults({
    factoryId,
    workItems: workItems.items,
    issues: intake.issues,
    pullRequests: intake.pullRequests,
  });
  const counts = createGlobalSearchScopeCounts({
    work: sessionGroups.work.length,
    review: sessionGroups.review.length,
    items: unstartedItems.length,
    user: sessionGroups.user.length,
    factories: factories.length,
  });
  const sessionsPending = sessions.pending || workItems.pending;
  const hasRepositories = repositoryIds.length > 0;

  return (
    <>
      <CommandPaletteInput
        autoFocus
        placeholder="Search sessions, reviews, #issues, pages, and Factories…"
        rightSlot={<Kbd>Esc</Kbd>}
      />

      <CommandPaletteBody>
        <GlobalSearchRail activeScope={activeScope} counts={counts} onScopeChange={setActiveScope} />
        <CommandPaletteResults aria-label="Search results" footer={<CommandPaletteFooter label="Factory search" />}>
          {!sessionsPending && !intake.pending && <CommandEmpty>No matching results.</CommandEmpty>}
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
                closeSearch();
                const target = result.target;
                if (target.kind === 'candidate') {
                  const [move] = cardMoves(target.candidate, target.candidate.column);
                  if (move) board.handleDrop(candidatePayload(target.candidate), move.stage, 'card_action');
                  return;
                }
                const [move] = cardMoves(target.item, 'intake');
                if (move) {
                  board.move(target.item.id, move.stage);
                  return;
                }
                void runs
                  .openOrCreateSession(target.item)
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
            <GlobalSearchSessionsStatus
              pending={sessionsPending}
              failedCount={sessions.failedCount}
              allFailed={sessions.allFailed}
              onRetry={sessions.retry}
            />
          )}
          {isWorkItemScope(activeScope) && hasRepositories && (
            <GlobalSearchWorkItemsStatus
              boardFailed={workItems.failed}
              intakeFailed={intake.failed}
              onRetry={() => {
                workItems.retry();
                intake.retry();
              }}
            />
          )}
          {scopeIncludes(activeScope, 'factories') && (
            <GlobalSearchFactoriesResults factories={factories} activeFactoryId={factoryId} onSelect={selectPath} />
          )}
        </CommandPaletteResults>
      </CommandPaletteBody>
    </>
  );
}
