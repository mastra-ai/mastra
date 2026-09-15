import { CommandPaletteRail, CommandPaletteScope } from '@mastra/playground-ui/components/CommandPalette';
import { Factory, GitBranch, GitPullRequest, Route, Search, SquareKanban, Ticket } from 'lucide-react';

import type { GlobalSearchScope, GlobalSearchScopeCounts } from '../services/searchScopes';

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
    <CommandPaletteRail aria-label="Search categories">
      <CommandPaletteScope
        icon={<Search />}
        label="All"
        count={counts.all}
        active={activeScope === 'all'}
        onSelect={() => onScopeChange('all')}
      />
      <CommandPaletteScope
        icon={<Route />}
        label="Navigation"
        count={counts.navigation}
        active={activeScope === 'navigation'}
        onSelect={() => onScopeChange('navigation')}
      />
      <CommandPaletteScope
        icon={<SquareKanban />}
        label="Work Sessions"
        count={counts.work}
        active={activeScope === 'work'}
        onSelect={() => onScopeChange('work')}
      />
      <CommandPaletteScope
        icon={<GitPullRequest />}
        label="Review Sessions"
        count={counts.review}
        active={activeScope === 'review'}
        onSelect={() => onScopeChange('review')}
      />
      <CommandPaletteScope
        icon={<Ticket />}
        label="Work Items"
        count={counts.items}
        active={activeScope === 'items'}
        onSelect={() => onScopeChange('items')}
      />
      <CommandPaletteScope
        icon={<GitBranch />}
        label="User Sessions"
        count={counts.user}
        active={activeScope === 'user'}
        onSelect={() => onScopeChange('user')}
      />
      <CommandPaletteScope
        icon={<Factory />}
        label="Factories"
        count={counts.factories}
        active={activeScope === 'factories'}
        onSelect={() => onScopeChange('factories')}
      />
    </CommandPaletteRail>
  );
}
