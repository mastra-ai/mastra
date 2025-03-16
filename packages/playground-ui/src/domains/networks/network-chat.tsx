import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { Thread } from '@/components/assistant-ui/thread';
import { ChatProps } from '@/types';
import { ToolFallback } from './tool-fallback';

export const NetworkChat = ({ agentId, memory }: ChatProps & { agents: string[] }) => {
  const runtime = useChatRuntime({
    api: `/api/networks/${agentId}/stream`,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread memory={memory} ToolFallback={ToolFallback} />
    </AssistantRuntimeProvider>
  );
};
