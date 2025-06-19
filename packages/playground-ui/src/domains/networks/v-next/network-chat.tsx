import { VNextThread } from '@/components/assistant-ui/threads-two';
import { MastraNetworkRuntimeProvider } from '@/services/network-runtime-provider';
import { ChatProps, Message } from '@/types';
// import { ToolFallback } from './tool-fallback';
// import { useContext } from 'react';
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
  // const { modelSettings } = useContext(NetworkContext);

  return (
    <MessagesProvider initialMessages={[]}>
      <VNextNetworkChatProvider networkId={networkId}>
        <VNextMastraNetworkRuntimeProvider
          networkId={networkId}
          initialMessages={[]}
          threadId={threadId}
          memory={memory}
          refreshThreadList={refreshThreadList}
        >
          <div className="h-full pb-4">
            <VNextThread hasMemory={memory} networkName={networkName} />
          </div>
        </VNextMastraNetworkRuntimeProvider>
      </VNextNetworkChatProvider>
    </MessagesProvider>
  );
};
