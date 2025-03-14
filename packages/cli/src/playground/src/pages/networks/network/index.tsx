import { NetworkChat } from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { cn } from '@/lib/utils';
import { NetworkInformation } from '@/domains/networks/network-information';
import { useMessages } from '@/hooks/use-memory';
import type { Message } from '@/types';
import { useNetwork } from '@/hooks/use-networks';

function Network() {
  const { networkId, threadId } = useParams();
  console.log(networkId, threadId);
  const { network, isLoading: isAgentLoading } = useNetwork(networkId!);

  console.log(network, networkId);

  // const { memory } = useMemory(networkId!);
  // const navigate = useNavigate();
  const { messages, isLoading: isMessagesLoading } = useMessages({
    agentId: networkId!,
    threadId: threadId!,
    memory: false,
  });

  // const [sidebar, setSidebar] = useState(true);
  // const {
  //     threads,
  //     isLoading: isThreadsLoading,
  //     mutate: refreshThreads,
  // } = useThreads({ resourceid: networkId!, agentId: networkId!, isMemoryEnabled: !!memory?.result });

  // useEffect(() => {
  //     if (memory?.result && !threadId) {
  //         // use @lukeed/uuid because we don't need a cryptographically secure uuid (this is a debugging local uuid)
  //         // using crypto.randomUUID() on a domain without https (ex a local domain like local.lan:4111) will cause a TypeError
  //         navigate(`/networks/${networkId}/chat/${uuid()}`);
  //     }
  // }, [memory?.result, threadId]);

  if (isAgentLoading) {
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
      {/* {sidebar && memory?.result ? (
                <div className="border-r">
                    <div className="p-4">
                        <h3 className="text-sm font-medium text-mastra-el-5 mb-2">Network Conversations</h3>
                        {isThreadsLoading ? (
                            <p className="text-sm text-mastra-el-4">Loading threads...</p>
                        ) : threads.length === 0 ? (
                            <p className="text-sm text-mastra-el-4">No conversations yet</p>
                        ) : (
                            <div className="space-y-2">
                                {threads.map((thread) => (
                                    <div
                                        key={thread.id}
                                        className={`p-2 rounded-md cursor-pointer text-sm ${thread.id === threadId ? 'bg-mastra-bg-3 text-mastra-el-5' : 'hover:bg-mastra-bg-2 text-mastra-el-4'}`}
                                        onClick={() => navigate(`/networks/${networkId}/chat/${thread.id}`)}
                                    >
                                        {thread.name || 'Conversation'}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : null} */}
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

export default Network;
