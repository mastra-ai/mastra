import { Header, HeaderTitle, MainContentLayout, NetworkTable, MainContentContent } from '@mastra/playground-ui';
import { useVNextNetworks } from '@/hooks/use-networks';

function Networks() {
  const { vNextNetworks, isLoading: isVNextLoading } = useVNextNetworks();

  const isEmpty = vNextNetworks.length === 0;

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Networks</HeaderTitle>
      </Header>

      <MainContentContent isCentered={isEmpty && !isVNextLoading}>
        <NetworkTable
          networks={vNextNetworks}
          isLoading={isVNextLoading}
          computeLink={(networkId: string) => {
            return `/networks/v-next/${networkId}/chat`;
          }}
        />
      </MainContentContent>
    </MainContentLayout>
  );
}

export default Networks;
