import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgent } from '@/hooks/use-agents';
import { AgentDetails } from './agent-details';
import { AgentEndpoints } from './agent-endpoints';
import { AgentLogs } from './agent-logs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge, Txt } from '@mastra/playground-ui';
import { AgentIcon } from '@mastra/playground-ui';
import { Icon } from '@mastra/playground-ui';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { CopyIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { providerMapToIcon } from './table.columns';
import { AgentOverview } from './agent-overview';

export function AgentInformation({ agentId }: { agentId: string }) {
  const { agent, isLoading } = useAgent(agentId);
  const { handleCopy } = useCopyToClipboard({ text: agentId });

  const providerIcon = providerMapToIcon[(agent?.provider || 'openai.chat') as keyof typeof providerMapToIcon];

  return (
    <div className="h-full">
      <div className="p-5 border-b-sm border-border1">
        <div className="text-icon6 flex items-center gap-2">
          <Icon size="lg" className="bg-surface4 rounded-md p-1">
            <AgentIcon />
          </Icon>

          {isLoading ? (
            <Skeleton className="h-3 w-1/3" />
          ) : (
            <div className="flex items-center gap-4">
              <Txt variant="header-md" as="h2" className="font-medium">
                {agent?.name}
              </Txt>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={handleCopy}>
                    <Icon className="transition-colors hover:bg-surface4 rounded-lg text-icon3 hover:text-icon6">
                      <CopyIcon />
                    </Icon>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Copy Agent ID for use in code</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Badge className="capitalize" icon={providerIcon}>
            {agent?.provider?.split('.')[0]}
          </Badge>

          <Badge>{agent?.modelId}</Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="h-full">
        <TabsList className="flex shrink-0 border-b">
          <TabsTrigger value="overview" className="group shrink-0">
            <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
              Overview
            </p>
          </TabsTrigger>

          <TabsTrigger value="model-settings" className="group shrink-0">
            <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
              Model settings
            </p>
          </TabsTrigger>

          <TabsTrigger value="endpoints" className="group shrink-0">
            <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
              Endpoints
            </p>
          </TabsTrigger>
          <TabsTrigger value="logs" className="group shrink-0">
            <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
              Log Drains
            </p>
          </TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}
