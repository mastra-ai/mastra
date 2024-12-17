import { ScrollArea } from '@shared/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';

import { AgentDetails } from './agent-details';

export function AgentInformation({ agentId }: { agentId: string }) {
  return (
    <Tabs defaultValue="details">
      <TabsList className="flex shrink-0 border-b">
        <TabsTrigger value="details" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Details
          </p>
        </TabsTrigger>
        <TabsTrigger value="endpoints" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Endpoints
          </p>
        </TabsTrigger>
        <TabsTrigger value="logs" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Logs
          </p>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details">
        <ScrollArea>
          <div className="h-[calc(100vh-126px)] space-y-4 p-4 text-xs">
            {agentId ? <AgentDetails agentId={agentId} /> : null}
          </div>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="endpoints">
        <ScrollArea>
          <div className="h-[calc(100vh-126px)] space-y-4 p-4 text-xs">
            <div className="grid grid-cols-[70px_1fr] gap-2">
              <p className="text-mastra-el-3">GET</p>
              <p className="text-mastra-el-5">/api/agents</p>
            </div>
            <div className="grid grid-cols-[70px_1fr] gap-2">
              <p className="text-mastra-el-3">GET</p>
              <p className="text-mastra-el-5">/api/agents/:agentId</p>
            </div>
            <div className="grid grid-cols-[70px_1fr] gap-2">
              <p className="text-mastra-el-3">POST</p>
              <p className="text-mastra-el-5">/api/agents/:agentId/text</p>
            </div>
            <div className="grid grid-cols-[70px_1fr] gap-2">
              <p className="text-mastra-el-3">POST</p>
              <p className="text-mastra-el-5">/api/agents/:agentId/stream</p>
            </div>
            <div className="grid grid-cols-[70px_1fr] gap-2">
              <p className="text-mastra-el-3">POST</p>
              <p className="text-mastra-el-5">/api/agents/:agentId/text-object</p>
            </div>
            <div className="grid grid-cols-[70px_1fr] gap-2">
              <p className="text-mastra-el-3">POST</p>
              <p className="text-mastra-el-5">/api/agents/:agentId/stream-object</p>
            </div>
          </div>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="logs">
        <ScrollArea>
          <div className="h-[calc(100vh-126px)] space-y-2 p-4 text-xs">
            <p className="text-mastra-el-5">No logs yet</p>
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}
