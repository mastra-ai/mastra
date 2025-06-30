import { useParams, Link } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { useNewUI } from '@/hooks/use-new-ui';
import { useNetwork, useVNextNetwork } from '@/hooks/use-networks';

import { NetworkHeader } from './network-header';
import { Header, HeaderTitle, MainContentLayout, MainLayout, MainHeader, MainNavbar } from '@mastra/playground-ui';
const newUIEnabled = useNewUI();

export const NetworkLayout = ({ children, isVNext }: { children: React.ReactNode; isVNext?: boolean }) => {
  const { networkId } = useParams();

  const { network, isLoading: isNetworkLoading } = useNetwork(networkId!, !isVNext);
  const { vNextNetwork, isLoading: isVNextNetworkLoading } = useVNextNetwork(networkId!, isVNext);

  const isLoadingToUse = isVNext ? isVNextNetworkLoading : isNetworkLoading;

  const networkToUse = isVNext ? vNextNetwork : network;

  return newUIEnabled ? (
    <MainLayout>
      <MainHeader>
        <MainNavbar
          linkComponent={Link}
          breadcrumbItems={[
            { label: 'Networks', to: '/networks' },
            { label: network?.name || '', to: `/networks/${networkId}`, isCurrent: true },
          ]}
          navItems={[[{ label: 'Chat', to: `/networks/${networkId}` }]]}
        />
      </MainHeader>
      {children}
    </MainLayout>
  ) : (
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
