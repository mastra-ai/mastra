import { CommandEmpty } from '@mastra/playground-ui/components/Command';
import {
  CommandPaletteBody,
  CommandPaletteFooter,
  CommandPaletteInput,
  CommandPaletteResults,
} from '@mastra/playground-ui/components/CommandPalette';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { useState } from 'react';

import { useGlobalSearchData } from '../hooks/useGlobalSearchData';
import { useGlobalSearchNavigation } from '../hooks/useGlobalSearchNavigation';
import { createGlobalSearchScopeCounts, isSessionScope, scopeIncludes } from '../services/searchScopes';
import type { GlobalSearchScope } from '../services/searchScopes';
import { GlobalSearchFactoriesResults } from './GlobalSearchFactoriesResults';
import { GlobalSearchNavigationResults } from './GlobalSearchNavigationResults';
import { GlobalSearchQueryStatus } from './GlobalSearchQueryStatus';
import { GlobalSearchRail } from './GlobalSearchRail';
import { GlobalSearchSessionResults } from './GlobalSearchSessionResults';

export function FactoryGlobalSearchContent({ factoryId, closeSearch }: { factoryId: string; closeSearch: () => void }) {
  const data = useGlobalSearchData(factoryId);
  const { selectPath } = useGlobalSearchNavigation(closeSearch);
  const [activeScope, setActiveScope] = useState<GlobalSearchScope>('all');
  const counts = createGlobalSearchScopeCounts({
    work: data.sessionGroups.work.length,
    review: data.sessionGroups.review.length,
    user: data.sessionGroups.user.length,
    factories: data.factories.length,
  });
  const showNavigation = scopeIncludes(activeScope, 'navigation');
  const showWork = scopeIncludes(activeScope, 'work');
  const showReview = scopeIncludes(activeScope, 'review');
  const showUser = scopeIncludes(activeScope, 'user');
  const showFactories = scopeIncludes(activeScope, 'factories');
  const showSessionStatus = isSessionScope(activeScope);

  return (
    <>
      <CommandPaletteInput
        autoFocus
        placeholder="Search sessions, reviews, pages, and Factories…"
        rightSlot={<Kbd>Esc</Kbd>}
      />

      <CommandPaletteBody>
        <GlobalSearchRail activeScope={activeScope} counts={counts} onScopeChange={setActiveScope} />
        <CommandPaletteResults aria-label="Search results" footer={<CommandPaletteFooter label="Factory search" />}>
          {!data.sessionDataPending && <CommandEmpty>No matching results.</CommandEmpty>}
          {showNavigation && <GlobalSearchNavigationResults factoryId={factoryId} onSelect={selectPath} />}
          {showWork && (
            <GlobalSearchSessionResults title="Work Sessions" results={data.sessionGroups.work} onSelect={selectPath} />
          )}
          {showReview && (
            <GlobalSearchSessionResults
              title="Review Sessions"
              results={data.sessionGroups.review}
              onSelect={selectPath}
            />
          )}
          {showUser && (
            <GlobalSearchSessionResults title="User Sessions" results={data.sessionGroups.user} onSelect={selectPath} />
          )}
          {showSessionStatus && data.hasRepositories && (
            <GlobalSearchQueryStatus
              pending={data.sessionDataPending}
              failedCount={data.failedRepositoryCount}
              allRepositoriesFailed={data.allRepositoriesFailed}
              workItemsFailed={data.workItemsFailed}
              retryRepositories={data.retryFailedRepositories}
              retryWorkItems={data.retryWorkItems}
            />
          )}
          {showFactories && (
            <GlobalSearchFactoriesResults
              factories={data.factories}
              activeFactoryId={factoryId}
              onSelect={selectPath}
            />
          )}
        </CommandPaletteResults>
      </CommandPaletteBody>
    </>
  );
}
