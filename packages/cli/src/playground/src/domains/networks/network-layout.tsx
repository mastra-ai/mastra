import { useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { useNetwork, useVNextNetwork } from '@/hooks/use-networks';

import { NetworkHeader } from './network-header';
import { Header, HeaderTitle } from '@mastra/playground-ui';

export const NetworkLayout = ({ children, isVNext }: { children: React.ReactNode; isVNext?: boolean }) => {
  const { networkId } = useParams();
  const { network, isLoading: isNetworkLoading } = useNetwork(networkId!, !isVNext);
  const { vNextNetwork, isLoading: isVNextNetworkLoading } = useVNextNetwork(networkId!, isVNext);

  return (
    <div className="h-full overflow-hidden">
      {isNetworkLoading || isVNextNetworkLoading ? (
        <Header>
          <HeaderTitle>
            <Skeleton className="h-6 w-[200px]" />
          </HeaderTitle>
        </Header>
      ) : (
        <NetworkHeader networkName={isVNext ? vNextNetwork?.name || '' : network?.name || ''} networkId={networkId!} />
      )}
      {children}
    </div>
  );
};
