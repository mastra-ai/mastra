import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgent } from '@/hooks/use-agents';
import { AgentDetails } from './agent-details';
import { AgentEndpoints } from './agent-endpoints';
import { AgentLogs } from './agent-logs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge, MemoryIcon, Txt } from '@mastra/playground-ui';
import { AgentIcon } from '@mastra/playground-ui';
import { Icon } from '@mastra/playground-ui';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { CopyIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { providerMapToIcon } from './table.columns';
import { AgentOverview } from './agent-overview';
import { useMemory } from '@/hooks/use-memory';

export function AgentInformation({ agentId }: { agentId: string }) {
  const { agent, isLoading } = useAgent(agentId);
  const { memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const { handleCopy } = useCopyToClipboard({ text: agentId });

  const providerIcon = providerMapToIcon[(agent?.provider || 'openai.chat') as keyof typeof providerMapToIcon];

  return (
    <div className="grid grid-rows-[auto_1fr] h-full items-start overflow-y-auto border-l-sm border-border1">
      <div className="p-5 border-b-sm border-border1">
        <div className="text-icon6 flex items-center gap-2 min-w-0">
          <Icon size="lg" className="bg-surface4 rounded-md p-1">
            <AgentIcon />
          </Icon>

          {isLoading || isMemoryLoading ? (
            <Skeleton className="h-3 w-1/3" />
          ) : (
            <Txt variant="header-md" as="h2" className="font-medium truncate">
              {agent?.name}
            </Txt>
          )}
        </div>
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
      </div>

      <Tabs defaultValue="overview" className="overflow-y-auto grid grid-rows-[auto_1fr] h-full">
        <TabsList className="flex border-b overflow-x-auto pl-5">
          <TabsTrigger value="overview" className="group">
            <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
              Overview
            </p>
          </TabsTrigger>

          <TabsTrigger value="model-settings" className="group">
            <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
              Model&nbsp;settings
            </p>
          </TabsTrigger>

          <TabsTrigger value="endpoints" className="group">
            <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
              Endpoints
            </p>
          </TabsTrigger>
          <TabsTrigger value="logs" className="group ">
            <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
              Log&nbsp;Drains
            </p>
          </TabsTrigger>
        </TabsList>

        <div className="overflow-y-auto">
          <TabsContent value="overview">
            {isLoading && <Skeleton className="h-full" />}
            {agent && <AgentOverview agent={agent} agentId={agentId} />}
          </TabsContent>
          <TabsContent value="model-settings">
            {isLoading && <Skeleton className="h-full" />}
            {agent && <AgentDetails agent={agent} />}
          </TabsContent>
          <TabsContent value="endpoints">
            {isLoading ? <Skeleton className="h-full" /> : <AgentEndpoints agentId={agentId} />}
          </TabsContent>
          <TabsContent value="logs">
            {isLoading ? <Skeleton className="h-full" /> : <AgentLogs agentId={agentId} />}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
