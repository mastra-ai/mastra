import { Avatar, EmptyState } from '@mastra/playground-ui';
import { SearchIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { LibraryAgent } from '../../fixtures/library-agents';
import { useLinkComponent } from '@/lib/framework';

export type AgentBuilderLibraryListProps = {
  agents: LibraryAgent[];
  search?: string;
};

export function AgentBuilderLibraryList({ agents, search }: AgentBuilderLibraryListProps) {
  const { Link } = useLinkComponent();

  const filtered = useMemo(() => {
    const q = (search ?? '').trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(a => {
      const name = a.name.toLowerCase();
      const description = a.description.toLowerCase();
      const owner = a.owner.name.toLowerCase();
      return name.includes(q) || description.includes(q) || owner.includes(q);
    });
  }, [agents, search]);

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center pt-10">
        <EmptyState
          iconSlot={<SearchIcon className="h-8 w-8 text-neutral3" />}
          titleSlot="No agents match your search"
          descriptionSlot="Try a different name, description, or owner."
        />
      </div>
    );
  }

  return (
    <div className="bg-surface2 border border-border1 rounded-xl divide-y divide-border1 overflow-hidden">
      {filtered.map(agent => (
        <Link
          key={agent.id}
          href={`/agent-builder/agents/${agent.id}/view`}
          className="px-6 py-5 flex items-center gap-4 hover:bg-surface3 transition-colors"
          data-testid="library-agent-row"
        >
          <div className="flex-1 min-w-0">
            <div className="text-ui-md text-neutral6 truncate">{agent.name}</div>
            <div className="text-ui-sm text-neutral3 line-clamp-1 mt-0.5">{agent.description}</div>
          </div>
          <div className="flex items-center gap-2 text-ui-sm text-neutral5 shrink-0" data-testid="library-agent-owner">
            <Avatar name={agent.owner.name} size="sm" />
            <span className="truncate max-w-[12rem]">{agent.owner.name}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
