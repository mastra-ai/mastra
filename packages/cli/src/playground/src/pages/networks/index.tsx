import {
  AgentNetworkCoinIcon,
  Button,
  DataTable,
  EmptyState,
  Icon,
  MainLayout,
  MainContent,
  MainHeader,
} from '@mastra/playground-ui';
import { useNetworks } from '@/hooks/use-networks';
import { networksTableColumns } from '@/domains/networks/table.columns';
import { NetworkIcon } from 'lucide-react';

function Networks() {
  const { networks, isLoading } = useNetworks();

  if (isLoading) return null;

  return (
    <MainLayout>
      <MainHeader variant="forList">
        <NetworkIcon /> Networks
      </MainHeader>

      {networks.length === 0 ? (
        <MainContent isCentered={true}>
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
        </MainContent>
      ) : (
        <MainContent>
          <DataTable isLoading={isLoading} data={networks} columns={networksTableColumns} />
        </MainContent>
      )}
    </MainLayout>
  );
}

export default Networks;
