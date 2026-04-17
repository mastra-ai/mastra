import type { StoredAgentResponse } from '@mastra/client-js';
import { AgentIcon, DashboardCard, truncateString } from '@mastra/playground-ui';
import { extractPrompt } from '@/domains/agents/utils/extractPrompt';
import { useLinkComponent } from '@/lib/framework';

export interface AgentStudioCardProps {
  agent: StoredAgentResponse;
  showAuthor?: boolean;
  currentUserId?: string;
}

export function AgentStudioCard({ agent, showAuthor = false, currentUserId }: AgentStudioCardProps) {
  const { Link } = useLinkComponent();
  const chatUrl = `/agent-studio/agents/${agent.id}/chat`;
  const description = agent.description ?? extractPrompt(agent.instructions as any);
  const authorLabel = agent.authorId ? (agent.authorId === currentUserId ? 'You' : agent.authorId) : 'Unknown author';

  return (
    <Link href={chatUrl} data-testid={`agent-studio-card-${agent.id}`}>
      <DashboardCard className="hover:border-border2 transition-colors h-full flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm">
          <AgentIcon />
          <span className="font-medium truncate">{agent.name || agent.id}</span>
        </div>
        <p className="text-xs text-icon4 min-h-[2.5rem]">{truncateString(description, 160) || 'No description'}</p>
        {showAuthor && (
          <p className="text-xs text-icon3">
            by <span className="text-icon4">{authorLabel}</span>
          </p>
        )}
      </DashboardCard>
    </Link>
  );
}
