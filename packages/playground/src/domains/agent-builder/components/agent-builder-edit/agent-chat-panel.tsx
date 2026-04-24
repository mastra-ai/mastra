import { MastraReactProvider, useChat } from '@mastra/react';
import { ChatComposer } from '../chat-primitives/chat-composer';
import { MessageRow } from '../chat-primitives/messages';
import { useAutoScroll } from './hooks/use-auto-scroll';
import { useChatDraft } from './hooks/use-chat-draft';

interface AgentChatPanelProps {
  agentId: string;
}

const AgentChat = ({ agentId }: AgentChatPanelProps) => {
  const { messages, sendMessage, isRunning } = useChat({ agentId });

  const send = (message: string) => {
    void sendMessage({ message });
  };

  const scrollRef = useAutoScroll(messages);
  const { draft, setDraft, trimmed, handleFormSubmit, handleKeyDown } = useChatDraft({ onSubmit: send });

  return (
    <div className="flex h-full min-h-0 flex-col px-6 pt-6">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto pb-4">
        <div className="flex flex-col gap-3">
          {messages.map(message => (
            <MessageRow key={message.id} message={message} />
          ))}
        </div>
      </div>

      <ChatComposer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={handleFormSubmit}
        onKeyDown={handleKeyDown}
        disabled={isRunning}
        canSubmit={trimmed.length > 0 && !isRunning}
        placeholder="Message the agent…"
        inputTestId="agent-builder-agent-chat-input"
        submitTestId="agent-builder-agent-chat-submit"
      />
    </div>
  );
};

export const AgentChatPanel = ({ agentId }: AgentChatPanelProps) => {
  return (
    <MastraReactProvider baseUrl="http://localhost:4112">
      <AgentChat agentId={agentId} />
    </MastraReactProvider>
  );
};
