import { useAgent } from '@/hooks/use-agents';
import { AgentDetails } from './agent-details';
import { AgentEndpoints } from './agent-endpoints';
import { AgentOverview } from './agent-overview';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Badge,
  MemoryIcon,
  RowContainer,
  MainColumnSection,
  InfoIcon,
  SettingsIcon,
  McpServerIcon,
  OpenAIIcon,
} from '@mastra/playground-ui';
import { providerMapToIcon } from './table.columns';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useMemory } from '@/hooks/use-memory';
import { Link } from 'react-router';
import { CopyIcon } from 'lucide-react';

export function AgentInformation({ agentId }: { agentId: string }) {
  const { agent, isLoading } = useAgent(agentId);
  const { handleCopy } = useCopyToClipboard({ text: agentId });
  const { memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const providerIcon = providerMapToIcon[(agent?.provider || 'openai.chat') as keyof typeof providerMapToIcon];

  return (
    <div>
      <MainColumnSection title="Agent info" icon={<InfoIcon />}>
        <RowContainer>
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

          <Badge className="capitalize shrink-0" icon={providerIcon}>
            {agent?.provider?.split('.')[0]}
          </Badge>

          <Badge className="shrink-0">{agent?.modelId}</Badge>

          <Tooltip>
            <TooltipTrigger asChild>
              <Badge icon={<MemoryIcon />} variant={memory?.result ? 'success' : 'error'} className="shrink-0">
                {memory?.result ? 'Memory is On' : 'Memory is Off'}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {memory?.result ? (
                'Memory is active, your messages will be persisted.'
              ) : (
                <>
                  <p>Memory is off, your messages will not be persisted neither available in the context.</p>
                  <p>
                    <Link to="https://mastra.ai/en/docs/memory/overview" target="_blank" className="underline">
                      See documentation to enable memory
                    </Link>
                  </p>
                </>
              )}
            </TooltipContent>
          </Tooltip>
        </RowContainer>
      </MainColumnSection>

      {agent && (
        <>
          <MainColumnSection title="Current instructions" icon={<McpServerIcon />}>
            <AgentOverview agent={agent} agentId={agentId} />
          </MainColumnSection>

          <MainColumnSection title="Model settings" icon={<SettingsIcon />}>
            <AgentDetails agent={agent} />
          </MainColumnSection>

          <MainColumnSection title="Endpoints" icon={<OpenAIIcon />}>
            <AgentEndpoints agentId={agentId} />
          </MainColumnSection>
        </>
      )}
    </div>
  );
}
