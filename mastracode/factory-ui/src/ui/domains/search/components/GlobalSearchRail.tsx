import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Factory, GitBranch, GitPullRequest, Route, Search, SquareKanban } from 'lucide-react';

import type { GlobalSearchScope, GlobalSearchScopeCounts } from '../services/searchScopes';
import { GlobalSearchScopeButton } from './GlobalSearchScopeButton';

export function GlobalSearchRail({
  activeScope,
  counts,
  onScopeChange,
}: {
  activeScope: GlobalSearchScope;
  counts: GlobalSearchScopeCounts;
  onScopeChange: (scope: GlobalSearchScope) => void;
}) {
  return (
    <aside
      aria-label="Search categories"
      className="global-search-surface global-search-surface-rail border-border1 bg-surface2 flex max-h-[min(14rem,32dvh)] min-h-0 flex-col overflow-hidden rounded-2xl border p-3 shadow-[0_8px_24px_-20px_rgb(0_0_0_/_0.55)] md:h-full md:max-h-none"
    >
      <ScrollArea className="-m-1 min-h-0 flex-1 p-1" viewPortClassName="pr-1">
        <div className="flex flex-col gap-1">
          <GlobalSearchScopeButton
            icon={<Search />}
            label="All"
            count={counts.all}
            active={activeScope === 'all'}
            onSelect={() => onScopeChange('all')}
          />
          <GlobalSearchScopeButton
            icon={<Route />}
            label="Navigation"
            count={counts.navigation}
            active={activeScope === 'navigation'}
            onSelect={() => onScopeChange('navigation')}
          />
          <GlobalSearchScopeButton
            icon={<SquareKanban />}
            label="Work Sessions"
            count={counts.work}
            active={activeScope === 'work'}
            onSelect={() => onScopeChange('work')}
          />
          <GlobalSearchScopeButton
            icon={<GitPullRequest />}
            label="Review Sessions"
            count={counts.review}
            active={activeScope === 'review'}
            onSelect={() => onScopeChange('review')}
          />
          <GlobalSearchScopeButton
            icon={<GitBranch />}
            label="User Sessions"
            count={counts.user}
            active={activeScope === 'user'}
            onSelect={() => onScopeChange('user')}
          />
          <GlobalSearchScopeButton
            icon={<Factory />}
            label="Factories"
            count={counts.factories}
            active={activeScope === 'factories'}
            onSelect={() => onScopeChange('factories')}
          />
        </div>
      </ScrollArea>
    </aside>
  );
}
