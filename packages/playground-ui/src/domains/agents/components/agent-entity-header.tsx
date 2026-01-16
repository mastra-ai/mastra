import { EntityHeader } from '@/ds/components/EntityHeader';
import { Badge } from '@/ds/components/Badge';
import { CopyIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { useAgent } from '../hooks/use-agent';

export interface AgentEntityHeaderProps {
  agentId: string;
}

export const AgentEntityHeader = ({ agentId }: AgentEntityHeaderProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const { handleCopy } = useCopyToClipboard({ text: agentId });
  const agentName = agent?.name || '';

  return (
    <TooltipProvider>
      <EntityHeader icon={<AgentIcon />} title={agentName} isLoading={isLoading}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={handleCopy} className="h-badge-default shrink-0">
              <Badge icon={<CopyIcon />} variant="default">
                {agentId}
              </Badge>
            </button>
          </TooltipTrigger>
          <TooltipContent>Copy Agent ID for use in code</TooltipContent>
        </Tooltip>
      </EntityHeader>
    </TooltipProvider>
  );
};
