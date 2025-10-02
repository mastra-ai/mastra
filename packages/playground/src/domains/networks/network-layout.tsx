import { useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { useVNextNetwork } from '@/hooks/use-networks';

import { NetworkHeader } from './network-header';
import { Header, HeaderTitle, MainContentLayout } from '@mastra/playground-ui';

export const NetworkLayout = ({ children }: { children: React.ReactNode }) => {
  const { networkId } = useParams();
  const { vNextNetwork, isLoading: isVNextNetworkLoading } = useVNextNetwork(networkId!);

  const isLoadingToUse = isVNextNetworkLoading;

  const networkToUse = vNextNetwork;

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
