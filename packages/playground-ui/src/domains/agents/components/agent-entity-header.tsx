import { EntityHeader } from '@/components/ui/entity-header';
import { Badge } from '@/ds/components/Badge';
import { CopyIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { AgentIcon } from '@/ds/icons/AgentIcon';

export interface AgentEntityHeaderProps {
  agentId: string;
  isLoading: boolean;
  agentName: string;
}

export const AgentEntityHeader = ({ agentId, isLoading, agentName }: AgentEntityHeaderProps) => {
  const { handleCopy } = useCopyToClipboard({ text: agentId });

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
