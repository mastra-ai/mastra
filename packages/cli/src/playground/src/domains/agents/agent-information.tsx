import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { AgentDetails } from './agent-details';
import { AgentEndpoints } from './agent-endpoints';
import { AgentPromptEnhancer } from './agent-instructions-enhancer';
import { AgentLogs } from './agent-logs';

export function AgentInformation({ agentId }: { agentId: string }) {
  return (
    <Tabs defaultValue="details" className="border-l-[1px] h-full">
      <TabsList className="flex shrink-0 border-b">
        <TabsTrigger value="details" className="group shrink-0">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Overview
          </p>
        </TabsTrigger>
        <TabsTrigger value="instructions" className="group shrink-0">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Instructions
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
      <TabsContent value="details">{agentId ? <AgentDetails agentId={agentId} /> : null}</TabsContent>
      <TabsContent value="endpoints">
        <AgentEndpoints agentId={agentId} />
      </TabsContent>
      <TabsContent value="logs">
        <AgentLogs agentId={agentId} />
      </TabsContent>
      <TabsContent value="instructions">
        <AgentPromptEnhancer agentId={agentId} />
      </TabsContent>
    </Tabs>
  );
}
