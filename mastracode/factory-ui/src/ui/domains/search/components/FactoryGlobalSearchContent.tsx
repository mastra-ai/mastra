import { CommandEmpty, CommandInput, CommandList } from '@mastra/playground-ui/components/Command';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { useState } from 'react';

import { useGlobalSearchData } from '../hooks/useGlobalSearchData';
import { useGlobalSearchNavigation } from '../hooks/useGlobalSearchNavigation';
import { createGlobalSearchScopeCounts, isSessionScope, scopeIncludes } from '../services/searchScopes';
import type { GlobalSearchScope } from '../services/searchScopes';
import { GlobalSearchFactoriesResults } from './GlobalSearchFactoriesResults';
import { GlobalSearchFooter } from './GlobalSearchFooter';
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
      <CommandInput
        autoFocus
        placeholder="Search sessions, reviews, pages, and Factories…"
        rightSlot={<Kbd>Esc</Kbd>}
        wrapperClassName="global-search-surface global-search-surface-input"
      />

      <div className="min-h-0 flex-1 rounded-2xl">
        <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 md:grid-cols-[13rem_minmax(0,1fr)] md:grid-rows-none">
          <GlobalSearchRail activeScope={activeScope} counts={counts} onScopeChange={setActiveScope} />

          <div
            role="region"
            aria-label="Search results"
            className="global-search-surface global-search-surface-results global-search-results-panel border-border1 bg-surface2 relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border shadow-[0_10px_28px_-22px_rgb(0_0_0_/_0.6)]"
          >
            <CommandList
              scrollArea
              scrollAreaClassName="min-h-0 flex-1 rounded-none"
              scrollAreaViewportClassName="global-search-scroll-viewport"
              className="global-search-list max-h-none rounded-none border-none bg-transparent shadow-none"
            >
              {!data.sessionDataPending && <CommandEmpty>No matching results.</CommandEmpty>}
              {showNavigation && <GlobalSearchNavigationResults factoryId={factoryId} onSelect={selectPath} />}
              {showWork && (
                <GlobalSearchSessionResults
                  title="Work Sessions"
                  results={data.sessionGroups.work}
                  onSelect={selectPath}
                />
              )}
              {showReview && (
                <GlobalSearchSessionResults
                  title="Review Sessions"
                  results={data.sessionGroups.review}
                  onSelect={selectPath}
                />
              )}
              {showUser && (
                <GlobalSearchSessionResults
                  title="User Sessions"
                  results={data.sessionGroups.user}
                  onSelect={selectPath}
                />
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
            </CommandList>
            <GlobalSearchFooter />
          </div>
        </div>
      </div>
    </>
  );
}
