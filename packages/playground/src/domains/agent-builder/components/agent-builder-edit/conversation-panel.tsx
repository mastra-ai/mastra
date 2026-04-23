import { useChat } from '@mastra/react';

import type { useBuilderAgentFeatures } from '../../hooks/use-builder-agent-features';
import { MessageRow } from '../chat-primitives/messages';
import { ConversationComposer } from './conversation-composer';
import { ConversationHeader } from './conversation-header';
import { useAgentBuilderTool } from './hooks/use-agent-builder-tool';
import type { AvailableTool } from './hooks/use-agent-builder-tool';
import { useAutoScroll } from './hooks/use-auto-scroll';
import { useChatDraft } from './hooks/use-chat-draft';
import { useInitialMessage } from './hooks/use-initial-message';

interface ConversationPanelProps {
  initialUserMessage?: string;
  features: ReturnType<typeof useBuilderAgentFeatures>;
  availableTools?: AvailableTool[];
  toolsReady?: boolean;
}

export const ConversationPanel = ({
  initialUserMessage,
  features,
  availableTools = [],
  toolsReady = true,
}: ConversationPanelProps) => {
  const { messages, sendMessage, isRunning } = useChat({
    agentId: 'builder-agent',
  });

  const agentBuilderTool = useAgentBuilderTool({ features, availableTools });

  const send = (message: string) => {
    void sendMessage({ message, clientTools: { agentBuilderTool } });
  };

  useInitialMessage({ initialUserMessage, toolsReady, onSend: send });
  const scrollRef = useAutoScroll(messages);
  const { draft, setDraft, trimmed, handleFormSubmit, handleKeyDown } = useChatDraft({ onSubmit: send });

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface1 pt-6">
      <ConversationHeader />

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pb-4">
        <div className="flex flex-col gap-3">
          {messages.map(message => (
            <MessageRow key={message.id} message={message} />
          ))}
        </div>
      </div>

      <ConversationComposer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={handleFormSubmit}
        onKeyDown={handleKeyDown}
        disabled={isRunning}
        canSubmit={trimmed.length > 0 && !isRunning}
      />
    </div>
  );
};
