import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { NetworkDetails } from './network-details';
// import { NetworkEndpoints } from './network-endpoints';
// import { NetworkAgents } from './network-agents';
// import { NetworkLogs } from './network-logs';

export function NetworkInformation({ networkId }: { networkId: string }) {
  return (
    <Tabs defaultValue="details">
      <TabsList className="flex shrink-0 border-b">
        <TabsTrigger value="details" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Details
          </p>
        </TabsTrigger>
        <TabsTrigger value="agents" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Agents
          </p>
        </TabsTrigger>
        <TabsTrigger value="endpoints" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Endpoints
          </p>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details">{networkId ? <NetworkDetails networkId={networkId} /> : null}</TabsContent>
      {/* <TabsContent value="agents">
                <NetworkAgents networkId={networkId} />
            </TabsContent>
            <TabsContent value="endpoints">
                <NetworkEndpoints networkId={networkId} />
            </TabsContent> */}
    </Tabs>
  );
}
