import { NetworkThread } from '@/components/assistant-ui/network-threads';
import { Message } from '@/types';
import { VNextMastraNetworkRuntimeProvider } from '@/services/vnext-network-runtime-provider';
import { VNextNetworkChatProvider } from '@/services/vnext-network-chat-provider';
import { MessagesProvider } from '@/services/vnext-message-provider';

export const VNextNetworkChat = ({
  networkId,
  networkName,
  threadId,
  initialMessages,
  memory,
  refreshThreadList,
}: {
  networkId: string;
  networkName: string;
  threadId: string;
  initialMessages?: Message[];
  memory?: boolean;
  refreshThreadList?: () => void;
}) => {
  return (
    <MessagesProvider key={threadId}>
      <VNextNetworkChatProvider networkId={networkId} key={threadId}>
        <VNextMastraNetworkRuntimeProvider
          key={threadId}
          networkId={networkId}
          initialMessages={initialMessages ?? []}
          threadId={threadId}
          memory={memory}
          refreshThreadList={refreshThreadList}
        >
          <div className="h-full pb-4">
            <NetworkThread hasMemory={memory} networkName={networkName} />
          </div>
        </VNextMastraNetworkRuntimeProvider>
      </VNextNetworkChatProvider>
    </MessagesProvider>
  );
};
