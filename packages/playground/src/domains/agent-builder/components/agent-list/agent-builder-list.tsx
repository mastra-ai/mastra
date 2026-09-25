import type { StoredAgentResponse } from '@mastra/client-js';
import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { LockIcon } from 'lucide-react';
import { useMemo } from 'react';
import { FavoriteButton } from './favorite-button';
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
    <div className={cn('flex min-w-0 items-center gap-1.5', className)} data-testid="agent-builder-row-author">
      <Avatar name={label} src={avatarUrl} size="sm" />
      <span className="truncate text-meta text-muted-foreground">{label}</span>
    </div>
  );
}

function PrivateVisibilityIcon() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="shrink-0 text-muted-foreground"
          aria-label="Private agent"
          data-testid="agent-builder-private-visibility-icon"
        >
          <Icon size="xs">
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
      <div className="flex items-center-safe justify-center-safe">
        <EmptyState titleSlot="No agents match your search" descriptionSlot="Try a different name or description." />
      </div>
    );
  }

  return (
    <div className="h-full content-start divide-y divide-border overflow-y-auto rounded-xl border border-border bg-background">
      {filtered.map(agent => {
        const avatar = getAvatarUrl(agent);

        return (
          <Link
            key={agent.id}
            href={`/agent-builder/agents/${agent.id}/view`}
            className="flex items-start gap-4 px-4 py-3 hover:bg-fill-subtle md:items-center"
            data-testid={rowTestId}
          >
            <Avatar name={agent.name ?? ''} src={avatar} size="lg" />

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <div className="truncate text-body text-foreground">{agent.name}</div>
                {agent.visibility === 'private' && <PrivateVisibilityIcon />}
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="line-clamp-1 text-caption text-muted-foreground">
                  {agent.description || 'No description'}
                </span>
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
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3" data-testid={rowTestId}>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-48 animate-pulse rounded bg-card" />
            <div className="h-3 w-72 max-w-full animate-pulse rounded bg-card" />
          </div>
        </div>
      ))}
    </div>
  );
}
