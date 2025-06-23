import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNetwork, useVNextNetwork } from '@/hooks/use-networks';
import { NetworkDetails } from './network-details';
import { NetworkAgents } from './network-agents';
import { NetworkEndpoints } from './network-endpoints';
import { NetworkWorkflows } from './network-workflows';
import { GetVNextNetworkResponse } from '@mastra/client-js';

export function NetworkInformation({ networkId, isVNext }: { networkId: string; isVNext?: boolean }) {
  const { network, isLoading } = useNetwork(networkId, !isVNext);
  const { vNextNetwork, isLoading: isVNextNetworkLoading } = useVNextNetwork(networkId, isVNext);

  const networkToUse = isVNext ? vNextNetwork : network;
  const isLoadingToUse = isVNext ? isVNextNetworkLoading : isLoading;

  if (!networkToUse || isLoadingToUse) {
    return null;
  }

  return (
    <Tabs defaultValue="details" className="overflow-y-auto grid grid-rows-[auto_1fr] h-full">
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
        {isVNext ? (
          <TabsTrigger value="workflows" className="group">
            <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
              Workflows
            </p>
          </TabsTrigger>
        ) : null}
        <TabsTrigger value="endpoints" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Endpoints
          </p>
        </TabsTrigger>
      </TabsList>
      <div className="overflow-y-auto">
        <TabsContent value="details">
          <NetworkDetails network={networkToUse} />
        </TabsContent>
        <TabsContent value="agents">
          <NetworkAgents network={networkToUse} />
        </TabsContent>
        {isVNext ? (
          <TabsContent value="workflows">
            <NetworkWorkflows network={networkToUse as GetVNextNetworkResponse} />
          </TabsContent>
        ) : null}
        <TabsContent value="endpoints">
          <NetworkEndpoints networkId={networkId} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
