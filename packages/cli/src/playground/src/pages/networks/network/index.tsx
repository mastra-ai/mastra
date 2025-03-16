import { NetworkInformation } from '@/domains/networks/network-information';
import { useMessages } from '@/hooks/use-memory';
import { useNetwork } from '@/hooks/use-networks';
import { cn } from '@/lib/utils';
import { NetworkChat } from '@mastra/playground-ui';
import { useParams } from 'react-router';

export default function Network() {
  const { networkId, threadId } = useParams();

  const { network, isLoading: isNetworkLoading } = useNetwork(networkId!);

  const { messages, isLoading: isMessagesLoading } = useMessages({
    agentId: networkId!,
    threadId: threadId!,
    memory: false,
  });

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
    <section className={cn('relative grid h-full divide-x', 'grid-cols-[1fr_400px]')}>
      <div className="relative overflow-y-hidden">
        <NetworkChat
          agentId={networkId!}
          agentName={network?.name}
          agents={network?.agents?.map(a => a.name.replace(/[^a-zA-Z0-9_-]/g, '_')) || []}
          threadId={threadId!}
          initialMessages={isMessagesLoading ? undefined : (messages as Message[])}
        />
      </div>
      <div className="flex flex-col">
        <NetworkInformation networkId={networkId!} />
      </div>
    </section>
  );
}
