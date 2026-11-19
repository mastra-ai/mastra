import { AgentChatFeaturesProvider, ChatProvider as BaseChatProvider } from '@mastra/playground-ui/domains/agents/chat';
import type { ChatProps } from '@mastra/playground-ui/domains/agents/chat';
import type { ReactNode } from 'react';
import { useObservationalMemoryContext } from '@/domains/agents/context/agent-observational-memory-context';
import { useWorkingMemory } from '@/domains/agents/context/agent-working-memory-context';
import { usePlaygroundModelOptional } from '@/domains/agents/context/playground-model-context';

/**
 * Studio chat runtime. Observational memory, working memory, and the model
 * override stay here so the shared provider never imports Studio contexts.
 */
export function ChatProvider({ children, ...props }: Readonly<{ children: ReactNode }> & ChatProps) {
  const observationalMemory = useObservationalMemoryContext();
  const { refetch: refreshWorkingMemory } = useWorkingMemory();
  const modelOverride = usePlaygroundModelOptional()?.modelOverride;

  return (
    <AgentChatFeaturesProvider
      value={{
        observationalMemory,
        refreshWorkingMemory,
        modelOverride,
      }}
    >
      <BaseChatProvider {...props}>{children}</BaseChatProvider>
    </AgentChatFeaturesProvider>
  );
}
