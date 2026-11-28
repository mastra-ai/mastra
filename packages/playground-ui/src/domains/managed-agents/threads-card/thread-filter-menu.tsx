import { Avatar } from '@/ds/components/Avatar';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { InputGroupButton } from '@/ds/components/InputGroup';
import { IconFilter2 } from '@/ds/icons/central/IconFilter2';
import { cn } from '@/lib/utils';

export type ThreadVisibilityFilter = 'all' | 'private' | 'shared';

export interface ThreadFilterAgent {
  id: string;
  name: string;
  avatar?: string;
}

const VISIBILITY = [
  { value: 'all', label: 'All threads' },
  { value: 'private', label: 'Private' },
  { value: 'shared', label: 'Shared with the project' },
] as const;

export interface ThreadFilterMenuProps {
  agents: ThreadFilterAgent[];
  agentIds: string[];
  onAgentIdsChange: (agentIds: string[]) => void;
  visibility: ThreadVisibilityFilter;
  onVisibilityChange: (visibility: ThreadVisibilityFilter) => void;
}

function filterLabel(picked: ThreadFilterAgent[], visibility: ThreadVisibilityFilter) {
  const parts = picked.map(agent => agent.name);
  if (visibility !== 'all') parts.push(visibility === 'private' ? 'private only' : 'shared only');
  return parts.length ? `Filter threads, showing ${parts.join(', ')}` : 'Filter threads';
}

export function ThreadFilterMenu({
  agents,
  agentIds,
  onAgentIdsChange,
  visibility,
  onVisibilityChange,
}: ThreadFilterMenuProps) {
  const pickedIds = new Set(agentIds);
  const picked = agents.filter(agent => pickedIds.has(agent.id));
  const activeCount = picked.length + (visibility === 'all' ? 0 : 1);
  const toggle = (id: string, checked: boolean) =>
    onAgentIdsChange(checked ? [...agentIds, id] : agentIds.filter(agentId => agentId !== id));

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <InputGroupButton
            size={activeCount ? 'sm' : 'icon-sm'}
            aria-label={filterLabel(picked, visibility)}
            className={cn(activeCount > 0 && 'gap-1 bg-fill px-1.5 text-foreground')}
          >
            <IconFilter2 />
            {activeCount > 0 ? (
              <span aria-hidden="true" className="tabular-nums">
                {activeCount}
              </span>
            ) : null}
          </InputGroupButton>
        }
      />
      <DropdownMenu.Content align="end" className="w-60">
        <DropdownMenu.Label>Agents</DropdownMenu.Label>
        {agents.map(agent => (
          <DropdownMenu.CheckboxItem
            key={agent.id}
            checked={pickedIds.has(agent.id)}
            onCheckedChange={checked => toggle(agent.id, checked)}
            closeOnClick={false}
          >
            <span aria-hidden="true" className="flex">
              <Avatar name={agent.name} src={agent.avatar} size="inline" />
            </span>
            <span>{agent.name}</span>
          </DropdownMenu.CheckboxItem>
        ))}
        <DropdownMenu.Separator />
        <DropdownMenu.Label>Visibility</DropdownMenu.Label>
        <DropdownMenu.RadioOptions options={VISIBILITY} value={visibility} onValueChange={onVisibilityChange} />
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
