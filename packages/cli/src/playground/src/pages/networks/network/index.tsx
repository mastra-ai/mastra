import { NetworkInformation } from '@/domains/networks/network-information';
import { useNetwork } from '@/hooks/use-networks';
import { useParams } from 'react-router';

export default function Network() {
  const { networkId, threadId } = useParams();
  console.log(networkId, threadId);
  const { network, isLoading: isNetworkLoading } = useNetwork(networkId!);

  if (isNetworkLoading) {
    return (
      <section className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
        <div className="flex flex-col">
          <NetworkInformation networkId={networkId!} />
        </div>
      </section>
    );
  }
  return (
    <section>
      <div className="flex flex-col">
        <NetworkInformation networkId={networkId!} />
      </div>
    </section>
  );
}
