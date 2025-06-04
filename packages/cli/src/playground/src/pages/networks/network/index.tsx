import { NetworkInformation } from '@/domains/networks/network-information';
import { useMessages } from '@/hooks/use-memory';
import { useNetwork } from '@/hooks/use-networks';
import { Message, NetworkChat, NetworkProvider } from '@mastra/playground-ui';
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
      <section className="grid grid-cols-[1fr_1fr]">
        <div />
        <div className="flex flex-col">
          <NetworkInformation networkId={networkId!} />
        </div>
      </section>
    );
  }

  return (
    <NetworkProvider>
      <div className="grid grid-cols-[1fr_1fr] h-full overflow-y-auto">
        <div className="grid overflow-y-auto relative bg-surface1 py-4">
          <NetworkChat
            agentId={networkId!}
            agentName={network?.name}
            // agents={network?.agents?.map(a => a.name.replace(/[^a-zA-Z0-9_-]/g, '_')) || []}
            threadId={threadId!}
            initialMessages={isMessagesLoading ? undefined : (messages as Message[])}
          />
        </div>
        <div className="border-l-sm h-full overflow-y-auto">
          <NetworkInformation networkId={networkId!} />
        </div>
      </div>
    </NetworkProvider>
  );
}
