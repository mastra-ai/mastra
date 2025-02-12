import { useNavigate } from 'react-router';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { AgentDetails } from './agent-details';
import { AgentEndpoints } from './agent-endpoints';
import { AgentLogs } from './agent-logs';
import { AgentPromptEnhancer } from './agent-prompt-enhancer';

export function AgentInformation({ agentId }: { agentId: string }) {
  const navigate = useNavigate();

  return (
    <Tabs defaultValue="details">
      <TabsList className="flex shrink-0 border-b">
        <TabsTrigger value="details" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Details
          </p>
        </TabsTrigger>
        <TabsTrigger value="prompt" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Instructions
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
        <button className="group" onClick={() => navigate(`/agents/${agentId}/evals`)}>
          <p className="text-xs p-3 text-mastra-el-3">Evals</p>
        </button>
      </TabsList>
      <TabsContent value="details">{agentId ? <AgentDetails agentId={agentId} /> : null}</TabsContent>
      <TabsContent value="endpoints">
        <AgentEndpoints agentId={agentId} />
      </TabsContent>
      <TabsContent value="logs">
        <AgentLogs agentId={agentId} />
      </TabsContent>
      <TabsContent value="prompt">
        <AgentPromptEnhancer agentId={agentId} />
      </TabsContent>
    </Tabs>
  );
}
