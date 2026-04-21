import type { StoredAgentResponse } from '@mastra/client-js';
import { DashboardCard, truncateString } from '@mastra/playground-ui';

import { AgentAvatar } from './agent-avatar';
import { resolveAgentAvatar } from './avatar';
import { StarButton } from './star-button';
import { resolveVisibility } from './visibility';
import { VisibilityBadge } from './visibility-badge';
import { extractPrompt } from '@/domains/agents/utils/extractPrompt';
import { useLinkComponent } from '@/lib/framework';

export interface AgentStudioCardProps {
  agent: StoredAgentResponse;
  showAuthor?: boolean;
  currentUserId?: string;
  /**
   * Resolved display name for the author (from IUserProvider). When absent,
   * we fall back to a shortened user id so we never render the raw UUID.
   */
  authorDisplayName?: string;
  /** Render the star toggle (library view). Hidden by default. */
  showStar?: boolean;
  /** Render the visibility badge. Default: true. */
  showVisibility?: boolean;
}

function shortenUserId(userId: string): string {
  // e.g. `user_abc123def456` → `user_abc1…`
  if (userId.length <= 12) return userId;
  return `${userId.slice(0, 10)}…`;
}

export function AgentStudioCard({
  agent,
  showAuthor = false,
  currentUserId,
  authorDisplayName,
  showStar = false,
  showVisibility = true,
}: AgentStudioCardProps) {
  const { Link } = useLinkComponent();
  const chatUrl = `/agent-studio/agents/${agent.id}/chat`;
  const description = agent.description ?? extractPrompt(agent.instructions as any);
  const authorLabel = !agent.authorId
    ? 'Unknown author'
    : agent.authorId === currentUserId
      ? 'You'
      : (authorDisplayName ?? shortenUserId(agent.authorId));
  const avatarUrl = resolveAgentAvatar(agent);
  const visibility = agent.visibility ?? resolveVisibility(agent.metadata);

  return (
    <Link href={chatUrl} data-testid={`agent-studio-card-${agent.id}`}>
      <DashboardCard className="hover:border-border2 transition-colors h-full flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <AgentAvatar name={agent.name} avatarUrl={avatarUrl} size={36} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate text-sm">{agent.name || agent.id}</span>
              {showVisibility && <VisibilityBadge visibility={visibility} />}
            </div>
            {showAuthor && (
              <p className="text-xs text-icon3 mt-0.5">
                by <span className="text-icon4">{authorLabel}</span>
              </p>
            )}
          </div>
          {showStar && <StarButton kind="agent" id={agent.id} />}
        </div>
        <p className="text-xs text-icon4 min-h-[2.5rem]">{truncateString(description, 160) || 'No description'}</p>
      </DashboardCard>
    </Link>
  );
}
