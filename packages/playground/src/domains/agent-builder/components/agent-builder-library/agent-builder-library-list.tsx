import type { StoredAgentResponse } from '@mastra/client-js';
import { AgentIcon, Avatar, EmptyState } from '@mastra/playground-ui';
import { SearchIcon } from 'lucide-react';
import { useMemo } from 'react';
import { StarButton } from '@/domains/agents/components/star-button';
import { useLinkComponent } from '@/lib/framework';

function getAvatarUrl(agent: StoredAgentResponse): string | undefined {
  const meta = agent.metadata;
  if (meta && typeof meta === 'object' && 'avatarUrl' in meta) {
    return meta.avatarUrl as string | undefined;
  }
  return undefined;
}

export type AgentBuilderLibraryListProps = {
  agents: StoredAgentResponse[];
  search?: string;
};

export function AgentBuilderLibraryList({ agents, search }: AgentBuilderLibraryListProps) {
  const { Link } = useLinkComponent();

  const filtered = useMemo(() => {
    const q = (search ?? '').trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(a => {
      const name = a.name?.toLowerCase() ?? '';
      const description = a.description?.toLowerCase() ?? '';
      return name.includes(q) || description.includes(q);
    });
  }, [agents, search]);

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center pt-10">
        <EmptyState
          iconSlot={<SearchIcon className="h-8 w-8 text-neutral3" />}
          titleSlot="No agents match your search"
          descriptionSlot="Try a different name or description."
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
          {getAvatarUrl(agent) ? (
            <Avatar name={agent.name ?? ''} src={getAvatarUrl(agent)} size="sm" />
          ) : (
            <div className="bg-surface3 p-2 rounded-md text-neutral5 flex items-center justify-center">
              <AgentIcon className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-ui-md text-neutral6 truncate">{agent.name}</div>
            <div className="text-ui-sm text-neutral3 line-clamp-1 mt-0.5">{agent.description || 'No description'}</div>
          </div>
          <StarButton
            agentId={agent.id}
            isStarred={agent.isStarred}
            starCount={agent.starCount}
            size="sm"
            className="shrink-0"
          />
        </Link>
      ))}
    </div>
  );
}

export function AgentBuilderLibraryListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-surface2 border border-border1 rounded-xl divide-y divide-border1 overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-6 py-5 flex items-center gap-4" data-testid="library-skeleton-row">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3.5 w-48 bg-surface3 rounded animate-pulse" />
            <div className="h-3 w-72 max-w-full bg-surface3 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
