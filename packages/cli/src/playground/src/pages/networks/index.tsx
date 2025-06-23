import {
  AgentNetworkCoinIcon,
  Button,
  DataTable,
  EmptyState,
  Header,
  HeaderTitle,
  Icon,
  MainContentLayout,
  MainContentContent,
} from '@mastra/playground-ui';
import { useNetworks, useVNextNetworks } from '@/hooks/use-networks';

import { networksTableColumns } from '@/domains/networks/table.columns';
import { NetworkIcon } from 'lucide-react';

function Networks() {
  const { networks, isLoading } = useNetworks();
  const { vNextNetworks, isLoading: isVNextLoading } = useVNextNetworks();

  if (isLoading || isVNextLoading) return null;

  const allNetworks = [
    ...(networks?.map(network => ({
      ...network,
      routingModel: network.routingModel.modelId,
      agentsSize: network.agents.length,
      isVNext: false,
    })) ?? []),
    ...(vNextNetworks?.map(network => ({
      ...network,
      routingModel: network.routingModel.modelId,
      agentsSize: network.agents.length,
      workflowsSize: network.workflows.length,
      isVNext: true,
    })) ?? []),
  ];

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Networks</HeaderTitle>
      </Header>

      {allNetworks.length === 0 ? (
        <MainContentContent isCentered={true}>
          <EmptyState
            iconSlot={<AgentNetworkCoinIcon />}
            titleSlot="Configure Agent Networks"
            descriptionSlot="Mastra agent networks are not configured yet. You can find more information in the documentation."
            actionSlot={
              <Button
                size="lg"
                className="w-full"
                variant="light"
                as="a"
                href="https://mastra.ai/en/reference/networks/agent-network"
                target="_blank"
              >
                <Icon>
                  <NetworkIcon />
                </Icon>
                Docs
              </Button>
            }
          />
        </MainContentContent>
      ) : (
        <MainContentContent>
          <DataTable isLoading={isLoading || isVNextLoading} data={allNetworks} columns={networksTableColumns} />
        </MainContentContent>
      )}
    </MainContentLayout>
  );
}

export default Networks;
