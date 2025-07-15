import { Header, HeaderTitle, MainContentLayout, NetworkTable, MainContentContent } from '@mastra/playground-ui';
import { useNetworks, useVNextNetworks } from '@/hooks/use-networks';
import { useNavigate } from 'react-router';

function Networks() {
  const navigate = useNavigate();
  const { networks, isLoading } = useNetworks();
  const { vNextNetworks, isLoading: isVNextLoading } = useVNextNetworks();

  const isEmpty = [...networks, ...vNextNetworks].length === 0;

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Networks</HeaderTitle>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <NetworkTable
          legacyNetworks={networks}
          networks={vNextNetworks}
          isLoading={isLoading || isVNextLoading}
          onClickRow={networkId => navigate(`/networks/${networkId}/chat`)}
        />
      </MainContentContent>
    </MainContentLayout>
  );
}

export default Networks;
