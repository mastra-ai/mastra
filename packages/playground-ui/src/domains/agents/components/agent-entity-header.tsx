import { CopyIcon, Link2, Check } from 'lucide-react';
import { useAgent } from '../hooks/use-agent';
import { Badge } from '@/ds/components/Badge';
import { EntityHeader } from '@/ds/components/EntityHeader';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export interface AgentEntityHeaderProps {
  agentId: string;
}

export const AgentEntityHeader = ({ agentId }: AgentEntityHeaderProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const { handleCopy } = useCopyToClipboard({ text: agentId });
  const sessionUrl = `${window.location.origin}/agents/${agentId}/session`;
  const { handleCopy: handleShareLink, isCopied: isShareCopied } = useCopyToClipboard({
    text: sessionUrl,
    copyMessage: 'Session URL copied to clipboard!',
  });
  const agentName = agent?.name || '';

  return (
    <TooltipProvider>
      <EntityHeader icon={<AgentIcon />} title={agentName} isLoading={isLoading}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleShareLink} className="h-badge-default shrink-0">
                <Badge icon={isShareCopied ? <Check /> : <Link2 />} variant="default">
                  Share
                </Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent>Copy session URL to share with your team</TooltipContent>
          </Tooltip>
        </div>
      </EntityHeader>
    </TooltipProvider>
  );
};
