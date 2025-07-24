import { useNetwork, useVNextNetwork } from '@/hooks/use-networks';
import { NetworkDetails } from './network-details';
import { NetworkAgents } from './network-agents';
import { NetworkEndpoints } from './network-endpoints';
import { NetworkWorkflows } from './network-workflows';
import { GetVNextNetworkResponse } from '@mastra/client-js';
import { NetworkTools } from './network-tools';
import { EntityHeader, PlaygroundTabs, Tab, TabContent, TabList } from '@mastra/playground-ui';
import { NetworkIcon } from 'lucide-react';

export function NetworkInformation({ networkId, isVNext }: { networkId: string; isVNext?: boolean }) {
  const { network, isLoading } = useNetwork(networkId, !isVNext);
  const { vNextNetwork, isLoading: isVNextNetworkLoading } = useVNextNetwork(networkId, isVNext);

  const networkToUse = isVNext ? vNextNetwork : network;
  const isLoadingToUse = isVNext ? isVNextNetworkLoading : isLoading;

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
            {isVNext ? (
              <>
                <Tab value="workflows">Workflows</Tab>
                <Tab value="tools">Tools</Tab>
              </>
            ) : null}
            <Tab value="endpoints">Endpoints</Tab>
          </TabList>

          <TabContent value="details">
            <NetworkDetails network={networkToUse} isVNext={isVNext} />
          </TabContent>
          <TabContent value="agents">
            <NetworkAgents network={networkToUse} />
          </TabContent>
          {isVNext ? (
            <>
              <TabContent value="workflows">
                <NetworkWorkflows network={networkToUse as GetVNextNetworkResponse} />
              </TabContent>
              <TabContent value="tools">
                <NetworkTools network={networkToUse as GetVNextNetworkResponse} />
              </TabContent>
            </>
          ) : null}
          <TabContent value="endpoints">
            <NetworkEndpoints networkId={networkId} isVNext={isVNext} />
          </TabContent>
        </PlaygroundTabs>
      </div>
    </div>
  );
}
