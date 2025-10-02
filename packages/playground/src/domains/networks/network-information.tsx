import { useVNextNetwork } from '@/hooks/use-networks';
import { NetworkDetails } from './network-details';
import { NetworkAgents } from './network-agents';
import { NetworkEndpoints } from './network-endpoints';
import { NetworkWorkflows } from './network-workflows';
import { GetVNextNetworkResponse } from '@mastra/client-js';
import { NetworkTools } from './network-tools';
import { EntityHeader, PlaygroundTabs, Tab, TabContent, TabList } from '@mastra/playground-ui';
import { NetworkIcon } from 'lucide-react';

export function NetworkInformation({ networkId }: { networkId: string }) {
  const { vNextNetwork, isLoading: isVNextNetworkLoading } = useVNextNetwork(networkId);

  const networkToUse = vNextNetwork;
  const isLoadingToUse = isVNextNetworkLoading;

  if (!networkToUse || isLoadingToUse) {
    return null;
  }

  return (
    <div className="grid grid-rows-[auto_1fr] h-full overflow-y-auto border-l-sm border-border1">
      <EntityHeader icon={<NetworkIcon />} title={networkToUse?.name || ''} isLoading={isLoadingToUse} />

      <div className="overflow-y-auto border-t-sm border-border1">
        <PlaygroundTabs defaultTab="details">
          <TabList>
            <Tab value="details">Details</Tab>
            <Tab value="agents">Agents</Tab>

            <Tab value="workflows">Workflows</Tab>
            <Tab value="tools">Tools</Tab>

            <Tab value="endpoints">Endpoints</Tab>
          </TabList>

          <TabContent value="details">
            <NetworkDetails network={networkToUse} />
          </TabContent>
          <TabContent value="agents">
            <NetworkAgents network={networkToUse} />
          </TabContent>

          <TabContent value="workflows">
            <NetworkWorkflows network={networkToUse as GetVNextNetworkResponse} />
          </TabContent>
          <TabContent value="tools">
            <NetworkTools network={networkToUse as GetVNextNetworkResponse} />
          </TabContent>

          <TabContent value="endpoints">
            <NetworkEndpoints networkId={networkId} />
          </TabContent>
        </PlaygroundTabs>
      </div>
    </div>
  );
}
