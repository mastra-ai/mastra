import { NetworkInformation } from '@/domains/networks/network-information';

import { cn } from '@/lib/utils';
import { VNextNetworkChat } from '@mastra/playground-ui';
import { useParams } from 'react-router';

export default function VNextNetwork() {
  const { networkId } = useParams();

  // const { vNextNetwork: network, isLoading: isNetworkLoading } = useVNextNetwork(networkId!);

  // // const { messages, isLoading: isMessagesLoading } = useMessages({
  // //   agentId: networkId!,
  // //   threadId: threadId!,
  // //   memory: false,
  // // });

  // if (isNetworkLoading) {
  //   return (
  //     <section className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
  //       <div className="flex flex-col">
  //         <NetworkInformation networkId={networkId!} isVNext />
  //       </div>
  //     </section>
  //   );
  // }
  return (
    <section className={cn('relative grid h-[calc(100%-40px)] divide-x', 'grid-cols-[1fr_400px]')}>
      <div className="relative overflow-y-hidden grow h-full min-w-[325px]">
        <VNextNetworkChat
          networkId={networkId!}
          // agentName={network?.name}
          // // agents={network?.agents?.map(a => a.name.replace(/[^a-zA-Z0-9_-]/g, '_')) || []}
          // threadId={threadId!}
          // initialMessages={isMessagesLoading ? undefined : (messages as Message[])}
        />
      </div>
      <div>
        <NetworkInformation networkId={networkId!} isVNext />
      </div>
    </section>
  );
}
