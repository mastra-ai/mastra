import { Thread } from '@/components/assistant-ui/thread';
import { MastraNetworkRuntimeProvider } from '@/services/network-runtime-provider';
import { ChatProps } from '@/types';
import { ToolFallback } from './tool-fallback';
import { useContext } from 'react';
import { NetworkContext } from './network-context';

export const NetworkChat = ({ agentId, memory }: ChatProps) => {
  const { modelSettings } = useContext(NetworkContext);

  return (
    <MastraNetworkRuntimeProvider agentId={agentId} memory={memory} modelSettings={modelSettings}>
      <Thread ToolFallback={ToolFallback} />
    </MastraNetworkRuntimeProvider>
  );
};
