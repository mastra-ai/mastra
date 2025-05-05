import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNetwork } from '@/hooks/use-networks';
import { NetworkDetails } from './network-details';
import { NetworkAgents } from './network-agents';
import { NetworkEndpoints } from './network-endpoints';

export function NetworkInformation({ networkId }: { networkId: string }) {
  const { network, isLoading } = useNetwork(networkId);

  if (!network || isLoading) {
    return null;
  }

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
      <TabsContent value="details">
        <NetworkDetails network={network} />
      </TabsContent>
      <TabsContent value="agents">
        <NetworkAgents network={network} />
      </TabsContent>
      <TabsContent value="endpoints">
        <NetworkEndpoints networkId={networkId} />
      </TabsContent>
    </Tabs>
  );
}
