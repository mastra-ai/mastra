import { useState } from 'react';

import { WorkflowTrigger } from '@mastra/playground-ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { WorkflowEndpoints } from './workflow-endpoints';
import { WorkflowLogs } from './workflow-logs';

export function WorkflowInformation({ workflowId }: { workflowId: string }) {
  const [runId, setRunId] = useState<string>('');
  return (
    <Tabs defaultValue="run">
      <TabsList className="flex shrink-0 border-b">
        <TabsTrigger value="run" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Run
          </p>
        </TabsTrigger>
        <TabsTrigger value="endpoints" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Endpoints
          </p>
        </TabsTrigger>
        <TabsTrigger value="logs" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Log Drains
          </p>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="run">
        {workflowId ? <WorkflowTrigger workflowId={workflowId} setRunId={setRunId} baseUrl="" /> : null}
      </TabsContent>
      <TabsContent value="endpoints">
        <WorkflowEndpoints workflowId={workflowId} />
      </TabsContent>
      <TabsContent value="logs">
        <WorkflowLogs runId={runId} />
      </TabsContent>
    </Tabs>
  );
}
