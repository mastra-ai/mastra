import { useParams } from 'react-router';

import { Header } from '@/components/ui/header';
import { Skeleton } from '@/components/ui/skeleton';

import { useNetwork } from '@/hooks/use-networks';

import { NetworkHeader } from './network-header';

export const NetworkLayout = ({ children }: { children: React.ReactNode }) => {
  const { networkId } = useParams();
  const { network, isLoading: isNetworkLoading } = useNetwork(networkId!);
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {isNetworkLoading ? (
        <Header title={<Skeleton className="h-6 w-[200px]" />} />
      ) : (
        <NetworkHeader networkName={network?.name!} networkId={networkId!} />
      )}
      {children}
    </div>
  );
};
