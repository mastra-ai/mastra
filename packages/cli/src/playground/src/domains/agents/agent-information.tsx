import { useAgent } from '@/hooks/use-agents';
import { AgentEndpoints } from './agent-endpoints';
import { AgentLogs } from './agent-logs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Badge,
  MemoryIcon,
  AgentIcon,
  AgentSettings,
  EntityHeader,
  PlaygroundTabs,
  Tab,
  TabContent,
  TabList,
} from '@mastra/playground-ui';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { CopyIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { providerMapToIcon } from './table.columns';
import { AgentOverview } from './agent-overview';
import { useMemory } from '@/hooks/use-memory';
import { AgentWorkingMemory } from './agent-working-memory';

export function AgentInformation({ agentId }: { agentId: string }) {
  const { agent, isLoading } = useAgent(agentId);
  const { memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const { handleCopy } = useCopyToClipboard({ text: agentId });

  const providerIcon = providerMapToIcon[(agent?.provider || 'openai.chat') as keyof typeof providerMapToIcon];

  return (
    <div className="grid grid-rows-[auto_1fr] h-full items-start overflow-y-auto border-l-sm border-border1">
      <EntityHeader icon={<AgentIcon />} title={agent?.name || ''} isLoading={isLoading || isMemoryLoading}>
        <div className="flex items-center gap-2 pt-2 flex-wrap">
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
        </div>
      </EntityHeader>

      <div className="overflow-y-auto border-t-sm border-border1">
        <PlaygroundTabs defaultTab="overview">
          <TabList>
            <Tab value="overview">Overview</Tab>
            <Tab value="model-settings">Model Settings</Tab>
            <Tab value="endpoints">Endpoints</Tab>
            <Tab value="logs">Log Drains</Tab>
            <Tab value="working-memory">Working Memory</Tab>
          </TabList>

          <TabContent value="overview">
            {isLoading && <Skeleton className="h-full" />}
            {agent && <AgentOverview agent={agent} agentId={agentId} />}
          </TabContent>
          <TabContent value="model-settings">
            {isLoading && <Skeleton className="h-full" />}
            {agent && <AgentSettings />}
          </TabContent>
          <TabContent value="endpoints">
            {isLoading ? <Skeleton className="h-full" /> : <AgentEndpoints agentId={agentId} />}
          </TabContent>
          <TabContent value="logs">
            {isLoading ? <Skeleton className="h-full" /> : <AgentLogs agentId={agentId} />}
          </TabContent>
          <TabContent value="working-memory">
            {isLoading ? <Skeleton className="h-full" /> : <AgentWorkingMemory />}
          </TabContent>
        </PlaygroundTabs>
      </div>
    </div>
  );
}
