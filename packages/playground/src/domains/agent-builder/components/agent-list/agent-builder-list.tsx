import type { StoredAgentResponse } from '@mastra/client-js';
import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { LockIcon, SearchIcon } from 'lucide-react';
import { useMemo } from 'react';
import { FavoriteButton } from './favorite-button';
import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';

export type AgentBuilderListProps = {
  agents: StoredAgentResponse[];
  search?: string;
  rowTestId?: string;
  showFavorites?: boolean;
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

function getAuthorLabel(agent: StoredAgentResponse): string | undefined {
  if (agent.author) {
    return agent.author.name || agent.author.email || agent.author.id;
  }
  if (agent.authorId) return agent.authorId;
  return undefined;
}

function AuthorBadge({ agent, className }: { agent: StoredAgentResponse; className?: string }) {
  const label = getAuthorLabel(agent);
  if (!label) return null;

  const avatarUrl = agent.author?.avatarUrl;

  return (
    <div className={cn('flex items-center gap-1.5 min-w-0', className)} data-testid="agent-builder-row-author">
      <Avatar name={label} src={avatarUrl} size="sm" />
      <span className="text-ui-xs text-neutral3 truncate">{label}</span>
    </div>
  );
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

export function AgentBuilderList({ agents, search, rowTestId, showFavorites = true }: AgentBuilderListProps) {
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
          iconSlot={<SearchIcon className="text-neutral3 h-8 w-8" />}
          titleSlot="No agents match your search"
          descriptionSlot="Try a different name or description."
        />
      </div>
    );
  }

  return (
    <div className="bg-surface2 border-border1 divide-border1 h-full content-start divide-y overflow-y-auto rounded-xl border">
      {filtered.map(agent => {
        const avatar = getAvatarUrl(agent);

        return (
          <Link
            key={agent.id}
            href={`/agent-builder/agents/${agent.id}/view`}
            className="hover:bg-surface3 flex items-start gap-4 px-6 py-5 transition-colors md:items-center"
            data-testid={rowTestId}
          >
            <Avatar name={agent.name ?? ''} src={avatar} size="lg" />

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <div className="text-ui-md text-neutral6 truncate">{agent.name}</div>
                {agent.visibility === 'private' && <PrivateVisibilityIcon />}
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-ui-sm text-neutral3 line-clamp-1">{agent.description || 'No description'}</span>
              </div>
              <AuthorBadge agent={agent} className="mt-2 md:hidden" />
              {showFavorites && (
                <div className="mt-2 md:hidden">
                  <FavoriteButton
                    agentId={agent.id}
                    isFavorited={agent.isFavorited}
                    favoriteCount={agent.favoriteCount}
                    size="sm"
                  />
                </div>
              )}
            </div>
            <AuthorBadge agent={agent} className="hidden max-w-[12rem] shrink-0 md:flex" />
            {showFavorites && (
              <FavoriteButton
                agentId={agent.id}
                isFavorited={agent.isFavorited}
                favoriteCount={agent.favoriteCount}
                size="sm"
                className="hidden shrink-0 md:inline-flex"
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function AgentBuilderListSkeleton({ rows = 4, rowTestId }: AgentBuilderListSkeletonProps) {
  return (
    <div className="bg-surface2 border-border1 divide-border1 divide-y overflow-hidden rounded-xl border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-5" data-testid={rowTestId}>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="bg-surface3 h-3.5 w-48 animate-pulse rounded" />
            <div className="bg-surface3 h-3 w-72 max-w-full animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
