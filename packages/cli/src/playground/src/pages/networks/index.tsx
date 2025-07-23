import { Header, HeaderTitle, MainContentLayout, NetworkTable, MainContentContent } from '@mastra/playground-ui';
import { useNetworks, useVNextNetworks } from '@/hooks/use-networks';

function Networks() {
  const { networks, isLoading } = useNetworks();
  const { vNextNetworks, isLoading: isVNextLoading } = useVNextNetworks();

  const isEmpty = [...networks, ...vNextNetworks].length === 0;

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Networks</HeaderTitle>
      </Header>

      <MainContentContent isCentered={isEmpty && !isLoading}>
        <NetworkTable
          legacyNetworks={networks}
          networks={vNextNetworks}
          isLoading={isLoading || isVNextLoading}
          computeLink={(networkId: string, isVNext: boolean) => {
            return isVNext ? `/networks/v-next/${networkId}/chat` : `/networks/${networkId}/chat`;
          }}
        />
      </MainContentContent>
    </MainContentLayout>
  );
}

export default Networks;
