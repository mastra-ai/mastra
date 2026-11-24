import { CommandEmpty } from '@mastra/playground-ui/components/Command';
import {
  CommandPaletteBody,
  CommandPaletteFooter,
  CommandPaletteInput,
  CommandPaletteResults,
} from '@mastra/playground-ui/components/CommandPalette';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { searchTerms } from '@mastra/factory/work-items/search-terms';
import { useState } from 'react';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { cardPath } from '../../workspaces/services/factoryPaths';
import { useGlobalSearchNavigation } from '../hooks/useGlobalSearchNavigation';
import { useGlobalSearchSessions } from '../hooks/useGlobalSearchSessions';
import { useGlobalSearchWorkItems } from '../hooks/useGlobalSearchWorkItems';
import { createSessionSearchGroups, createWorkItemSearchResults, matchingResults } from '../services/searchResults';
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
  const searchableFactoryId = repositoryIds.length > 0 ? factoryId : undefined;
  const sessions = useGlobalSearchSessions(searchableFactoryId);
  const [query, setQuery] = useState('');
  const workItems = useGlobalSearchWorkItems(searchableFactoryId, query);
  const catalog = useBoardCatalog(searchableFactoryId);
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
  // The board's own search decides which session and card rows show; the rail keeps counting them all.
  const terms = searchTerms(query);
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

      <CommandPaletteBody>
        <GlobalSearchRail activeScope={activeScope} counts={counts} onScopeChange={setActiveScope} />
        <CommandPaletteResults aria-label="Search results" footer={<CommandPaletteFooter label="Factory search" />}>
          {!sessionsPending && <CommandEmpty>No matching results.</CommandEmpty>}
          {scopeIncludes(activeScope, 'navigation') && (
            <GlobalSearchNavigationResults factoryId={factoryId} onSelect={selectPath} />
          )}
          {scopeIncludes(activeScope, 'work') && (
            <GlobalSearchSessionResults
              title="Work Sessions"
              results={matchingResults(sessionGroups.work, terms)}
              onSelect={selectPath}
            />
          )}
          {scopeIncludes(activeScope, 'review') && (
            <GlobalSearchSessionResults
              title="Review Sessions"
              results={matchingResults(sessionGroups.review, terms)}
              onSelect={selectPath}
            />
          )}
          {scopeIncludes(activeScope, 'items') && (
            <GlobalSearchWorkItemResults
              results={matchingResults(unstartedItems, terms)}
              onSelect={result => selectPath(cardPath(factoryId, result.item.id, undefined), false)}
            />
          )}
          {scopeIncludes(activeScope, 'user') && (
            <GlobalSearchSessionResults
              title="User Sessions"
              results={matchingResults(sessionGroups.user, terms)}
              onSelect={selectPath}
            />
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
