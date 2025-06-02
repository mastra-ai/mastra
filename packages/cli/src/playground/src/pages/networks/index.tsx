import { ScrollArea } from '@/components/ui/scroll-area';
import { AgentNetworkCoinIcon, Button, DataTable, EmptyState, Header, HeaderTitle, Icon } from '@mastra/playground-ui';
import { useNetworks } from '@/hooks/use-networks';
import { networksTableColumns } from '@/domains/networks/table.columns';
import { NetworkIcon } from 'lucide-react';

function Networks() {
  const { networks, isLoading } = useNetworks();

  if (isLoading) return null;

  return (
    <>
      <Header>
        <HeaderTitle>Networks</HeaderTitle>
      </Header>

      {networks.length === 0 ? (
        <div className="flex h-full items-center justify-center">
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
        </div>
      ) : (
        <ScrollArea className="h-full">
          <DataTable isLoading={isLoading} data={networks} columns={networksTableColumns} />
        </ScrollArea>
      )}
    </>
  );
}

export default Networks;
