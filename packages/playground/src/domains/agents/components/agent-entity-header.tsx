import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { Check, CopyIcon } from 'lucide-react';
import { useAgent } from '../hooks/use-agent';

export interface AgentEntityHeaderProps {
  agentId: string;
  agentVersionId?: string;
  threadId?: string;
}

export const AgentEntityHeader = ({ agentId }: AgentEntityHeaderProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const { handleCopy, isCopied } = useCopyToClipboard({ text: agentId });
  const agentName = agent?.name || '';

  return (
    <TooltipProvider delay={0}>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 overflow-x-hidden px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="flex min-w-0 max-w-full items-center gap-1.5 text-neutral6">
            <span className="flex size-6 shrink-0 items-center justify-center">
              <Icon>
                <AgentIcon />
              </Icon>
            </span>
            {isLoading ? (
              <Skeleton className="h-3 w-32" />
            ) : (
              <Txt variant="header-sm" as="h2" className="truncate font-medium">
                {agentName}
              </Txt>
            )}
          </div>

          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            onClick={handleCopy}
            aria-label="Copy Agent ID for use in code"
            tooltip={isCopied ? 'Copied Agent ID' : 'Copy Agent ID for use in code'}
            data-testid="agent-entity-header-copy-id"
          >
            {isCopied ? <Check /> : <CopyIcon />}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
};
