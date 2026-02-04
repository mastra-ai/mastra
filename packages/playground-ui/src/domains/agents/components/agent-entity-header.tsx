import { EntityHeader } from '@/ds/components/EntityHeader';
import { Badge } from '@/ds/components/Badge';
import { CopyIcon, Pencil } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { useAgent } from '../hooks/use-agent';
import { useExperimentalFeatures } from '@/lib/experimental-features';
import { useLinkComponent } from '@/lib/framework';
import { Truncate } from '@/ds/components/Truncate';
import { AgentSourceIcon } from './agent-source-icon';

export interface AgentEntityHeaderProps {
  agentId: string;
}

export const AgentEntityHeader = ({ agentId }: AgentEntityHeaderProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const { handleCopy } = useCopyToClipboard({ text: agentId });
  const { experimentalFeaturesEnabled } = useExperimentalFeatures();
  const { navigate } = useLinkComponent();
  const agentName = agent?.name || '';
  const isStoredAgent = agent?.source === 'stored';

  const showStoredAgentBadge = experimentalFeaturesEnabled && isStoredAgent;

  return (
    <TooltipProvider>
      <EntityHeader
        icon={experimentalFeaturesEnabled ? <AgentSourceIcon source={agent?.source} /> : <AgentIcon />}
        title={agentName}
        isLoading={isLoading}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={handleCopy} className="h-badge-default shrink-0">
              <Badge icon={<CopyIcon />} variant="default">
                {showStoredAgentBadge ? (
                  <Truncate untilChar="-" withTooltip={false}>
                    {agentId}
                  </Truncate>
                ) : (
                  agentId
                )}
              </Badge>
            </button>
          </TooltipTrigger>
          <TooltipContent>Copy Agent ID for use in code</TooltipContent>
        </Tooltip>
        {showStoredAgentBadge && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => navigate(`/cms/agents/${agentId}/edit`)} className="h-badge-default shrink-0 ml-2">
                <Badge icon={<Pencil />} variant="default">
                  Edit
                </Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent>Edit agent configuration</TooltipContent>
          </Tooltip>
        )}
      </EntityHeader>
    </TooltipProvider>
  );
};
