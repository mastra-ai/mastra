import { VNextThread } from '@/components/assistant-ui/threads-two';
import { MastraNetworkRuntimeProvider } from '@/services/network-runtime-provider';
import { ChatProps } from '@/types';
// import { ToolFallback } from './tool-fallback';
// import { useContext } from 'react';
import { VNextMastraNetworkRuntimeProvider } from '@/services/vnext-network-runtime-provider';
import { VNextNetworkChatProvider } from '@/services/vnext-network-chat-provider';
import { MessagesProvider } from '@/services/vnext-message-provider';

export const VNextNetworkChat = ({ networkId }: { networkId: string }) => {
  // const { modelSettings } = useContext(NetworkContext);

  return (
    <MessagesProvider initialMessages={[]}>
      <VNextNetworkChatProvider networkId={networkId}>
        <VNextMastraNetworkRuntimeProvider networkId={networkId}>
          <div className="h-full pb-4">
            <VNextThread />
          </div>
        </VNextMastraNetworkRuntimeProvider>
      </VNextNetworkChatProvider>
    </MessagesProvider>
  );
};
