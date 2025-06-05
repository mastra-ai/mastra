import { useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { useNetwork } from '@/hooks/use-networks';

import { NetworkHeader } from './network-header';
import { Header, HeaderTitle } from '@mastra/playground-ui';

export const NetworkLayout = ({ children }: { children: React.ReactNode }) => {
  const { networkId } = useParams();
  const { network, isLoading: isNetworkLoading } = useNetwork(networkId!);
  return (
    <div className="grid grid-rows-[auto_1fr] items-start content-start h-full">
      {isNetworkLoading ? (
        <Header>
          <HeaderTitle>
            <Skeleton className="h-6 w-[200px]" />
          </HeaderTitle>
        </Header>
      ) : (
        <NetworkHeader networkName={network?.name!} networkId={networkId!} />
      )}
      {children}
    </div>
  );
};
