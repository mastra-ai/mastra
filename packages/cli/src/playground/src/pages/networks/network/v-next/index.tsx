import { v4 as uuid } from '@lukeed/uuid';

import { useNetworkMemory, useNetworkMessages, useNetworkThreads } from '@/hooks/use-network-memory';

import { MainContentContent, Message, VNextNetworkChat } from '@mastra/playground-ui';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { NetworkSidebar } from '@/domains/networks/network-sidebar';
import { useVNextNetwork } from '@/hooks/use-networks';

export default function VNextNetwork() {
  const { networkId, threadId } = useParams();
  const navigate = useNavigate();

  const { memory } = useNetworkMemory(networkId!);
  const { vNextNetwork, isLoading: isNetworkLoading } = useVNextNetwork(networkId!);

  const { messages, isLoading: isMessagesLoading } = useNetworkMessages({
    networkId: networkId!,
    threadId: threadId!,
    memory: !!memory?.result,
  });
  const {
    threads,
    isLoading: isThreadsLoading,
    mutate: refreshThreads,
  } = useNetworkThreads({ resourceid: networkId!, networkId: networkId!, isMemoryEnabled: !!memory?.result });

  useEffect(() => {
    if (memory?.result && !threadId) {
      navigate(`/networks/v-next/${networkId}/chat/${uuid()}`);
    }
  }, [memory?.result, threadId]);

  if (isNetworkLoading) {
    return null;
  }

  const withSidebar = Boolean(memory?.result);

  return (
    <MainContentContent isDivided={true} hasLeftServiceColumn={withSidebar}>
      {withSidebar && (
        <NetworkSidebar networkId={networkId!} threadId={threadId!} threads={threads} isLoading={isThreadsLoading} />
      )}
      <div className="grid overflow-y-auto relative bg-surface1 py-4 col-span-2">
        <VNextNetworkChat
          networkId={networkId!}
          threadId={threadId!}
          refreshThreadList={refreshThreads}
          memory={memory?.result}
          networkName={vNextNetwork?.name!}
          initialMessages={isMessagesLoading ? undefined : (messages as Message[])}
        />
      </div>
    </MainContentContent>
  );
}
