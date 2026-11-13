import { CommandPaletteRail, CommandPaletteScope } from '@mastra/playground-ui/components/CommandPalette';
import { Factory } from 'lucide-react';

import type { GlobalSearchScope, GlobalSearchScopeCounts } from '../services/searchScopes';
import { IconBranch } from '@mastra/playground-ui/icons/central/IconBranch';
import { IconMagnifyingGlass } from '@mastra/playground-ui/icons/central/IconMagnifyingGlass';
import { IconPullRequest } from '@mastra/playground-ui/icons/central/IconPullRequest';
import { IconDirection1 } from '@mastra/playground-ui/icons/central/IconDirection1';
import { IconKanbanView } from '@mastra/playground-ui/icons/central/IconKanbanView';
import { IconTicket } from '@mastra/playground-ui/icons/central/IconTicket';

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
        icon={<IconMagnifyingGlass />}
        label="All"
        count={counts.all}
        active={activeScope === 'all'}
        onSelect={() => onScopeChange('all')}
      />
      <CommandPaletteScope
        icon={<IconDirection1 />}
        label="Navigation"
        count={counts.navigation}
        active={activeScope === 'navigation'}
        onSelect={() => onScopeChange('navigation')}
      />
      <CommandPaletteScope
        icon={<IconKanbanView />}
        label="Work sessions"
        count={counts.work}
        active={activeScope === 'work'}
        onSelect={() => onScopeChange('work')}
      />
      <CommandPaletteScope
        icon={<IconPullRequest />}
        label="Review sessions"
        count={counts.review}
        active={activeScope === 'review'}
        onSelect={() => onScopeChange('review')}
      />
      <CommandPaletteScope
        icon={<IconTicket />}
        label="Work items"
        count={counts.items}
        active={activeScope === 'items'}
        onSelect={() => onScopeChange('items')}
      />
      <CommandPaletteScope
        icon={<IconBranch />}
        label="User sessions"
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
