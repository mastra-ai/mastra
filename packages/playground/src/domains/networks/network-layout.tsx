import { useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { useNetwork, useVNextNetwork } from '@/hooks/use-networks';

import { NetworkHeader } from './network-header';
import { Header, HeaderTitle, MainContentLayout } from '@mastra/playground-ui';

export const NetworkLayout = ({ children, isVNext }: { children: React.ReactNode; isVNext?: boolean }) => {
  const { networkId } = useParams();
  const { network, isLoading: isNetworkLoading } = useNetwork(networkId!, !isVNext);
  const { vNextNetwork, isLoading: isVNextNetworkLoading } = useVNextNetwork(networkId!, isVNext);

  const isLoadingToUse = isVNext ? isVNextNetworkLoading : isNetworkLoading;

  const networkToUse = isVNext ? vNextNetwork : network;

  return (
    <MainContentLayout>
      {isLoadingToUse ? (
        <Header>
          <HeaderTitle>
            <Skeleton className="h-6 w-[200px]" />
          </HeaderTitle>
        </Header>
      ) : (
        <NetworkHeader networkName={networkToUse?.name!} networkId={networkId!} />
      )}
      {children}
    </MainContentLayout>
  );
};
