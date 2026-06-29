import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { CopyIcon, Check } from 'lucide-react';
import { useAgent } from '../hooks/use-agent';

export interface AgentEntityHeaderProps {
  agentId: string;
}

export const AgentEntityHeader = ({ agentId }: AgentEntityHeaderProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const { handleCopy, isCopied } = useCopyToClipboard({ text: agentId });
  const agentName = agent?.name || '';

  return (
    <TooltipProvider>
      <div className="p-3 min-w-0 overflow-x-hidden">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy Agent ID for use in code"
              className="group/agent-title text-neutral6 flex min-w-0 max-w-full cursor-pointer items-center gap-2"
              data-testid="agent-entity-header-copy-id"
            >
              <span className="flex size-7 shrink-0 items-center justify-center">
                <Icon size="lg">
                  <AgentIcon />
                </Icon>
              </span>
              {isLoading ? (
                <Skeleton className="h-3 w-32" />
              ) : (
                <Txt variant="header-md" as="h2" className="truncate font-medium">
                  {agentName}
                </Txt>
              )}
              {isCopied ? (
                <Check className="h-4 w-4 shrink-0 text-neutral3" />
              ) : (
                <CopyIcon className="h-4 w-4 shrink-0 text-neutral3 opacity-0 transition-opacity group-hover/agent-title:opacity-100 group-focus-visible/agent-title:opacity-100" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>Copy Agent ID for use in code</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};
