import type { StoredAgentResponse } from '@mastra/client-js';
import { Avatar, EmptyState, Icon, Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui';
import { LockIcon, SearchIcon } from 'lucide-react';
import { useMemo } from 'react';
import { StarButton } from '@/domains/agents/components/star-button';
import { useLinkComponent } from '@/lib/framework';

export type AgentBuilderListProps = {
  agents: StoredAgentResponse[];
  search?: string;
  rowTestId?: string;
};

export type AgentBuilderListSkeletonProps = {
  rows?: number;
  rowTestId?: string;
};

function getAvatarUrl(agent: StoredAgentResponse): string | undefined {
  const meta = agent.metadata;
  if (meta && typeof meta === 'object' && 'avatarUrl' in meta) {
    return meta.avatarUrl as string | undefined;
  }
  return undefined;
}

function PrivateVisibilityIcon() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="text-neutral3 shrink-0"
          aria-label="Private agent"
          data-testid="agent-builder-private-visibility-icon"
        >
          <Icon size="sm">
            <LockIcon />
          </Icon>
        </span>
      </TooltipTrigger>
      <TooltipContent>Only visible to you</TooltipContent>
    </Tooltip>
  );
}

export function AgentBuilderList({ agents, search, rowTestId }: AgentBuilderListProps) {
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
    <div className="bg-surface2 border h-full border-border1 rounded-xl divide-y divide-border1 overflow-y-auto content-start">
      {filtered.map(agent => {
        const avatar = getAvatarUrl(agent);

        return (
          <Link
            key={agent.id}
            href={`/agent-builder/agents/${agent.id}/view`}
            className="px-6 py-5 flex items-start gap-4 hover:bg-surface3 transition-colors md:items-center"
            data-testid={rowTestId}
          >
            <Avatar name={agent.name ?? ''} src={avatar} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="text-ui-md text-neutral6 truncate">{agent.name}</div>
                {agent.visibility === 'private' && <PrivateVisibilityIcon />}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-ui-sm text-neutral3 line-clamp-1">{agent.description || 'No description'}</span>
              </div>
              <div className="mt-2 md:hidden">
                <StarButton agentId={agent.id} isStarred={agent.isStarred} starCount={agent.starCount} size="sm" />
              </div>
            </div>
            <StarButton
              agentId={agent.id}
              isStarred={agent.isStarred}
              starCount={agent.starCount}
              size="sm"
              className="shrink-0 hidden md:inline-flex"
            />
          </Link>
        );
      })}
    </div>
  );
}

export function AgentBuilderListSkeleton({ rows = 4, rowTestId }: AgentBuilderListSkeletonProps) {
  return (
    <div className="bg-surface2 border border-border1 rounded-xl divide-y divide-border1 overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-6 py-5 flex items-center gap-4" data-testid={rowTestId}>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-3.5 w-48 bg-surface3 rounded animate-pulse" />
            <div className="h-3 w-72 max-w-full bg-surface3 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
