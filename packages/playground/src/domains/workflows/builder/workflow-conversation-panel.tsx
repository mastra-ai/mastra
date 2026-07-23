import { useState } from 'react';

import { ChatComposer } from '@/domains/agent-builder/components/chat-primitives/chat-composer';
import { MessageList } from '@/domains/agent-builder/components/chat-primitives/message-list';
import { AgentColorProvider } from '@/domains/agent-builder/contexts/agent-color-context';
import {
  useStreamMessages,
  useStreamRunning,
  useStreamRunningDebounced,
  useStreamSend,
} from '@/domains/agent-builder/contexts/stream-chat-context';
import { useChatDraft } from '@/domains/agent-builder/hooks/use-chat-draft';

export function WorkflowConversationPanel() {
  return (
    <AgentColorProvider agentId="workflow-builder">
      <div className="flex h-full min-h-0 flex-col">
        <WorkflowConversationMessages />
        <WorkflowConversationComposer />
      </div>
    </AgentColorProvider>
  );
}

function WorkflowConversationMessages() {
  const messages = useStreamMessages();
  const isRunning = useStreamRunning();

  return (
    <MessageList
      messages={messages}
      isRunning={isRunning}
      emptyState={
        <div className="grid h-full place-items-center px-8 text-center text-ui-sm text-neutral3">
          Describe the workflow you want to build. The builder will update the typed draft as it works.
        </div>
      }
    />
  );
}

function WorkflowConversationComposer() {
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const send = useStreamSend();
  const isRunning = useStreamRunningDebounced();
  const { draft, setDraft, trimmed, handleFormSubmit, handleKeyDown } = useChatDraft({
    onSubmit: message => {
      setHasSubmitted(true);
      send(message);
    },
  });

  return (
    <div className="p-4 pt-0">
      <ChatComposer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={handleFormSubmit}
        onKeyDown={handleKeyDown}
        disabled={isRunning}
        isRunning={isRunning}
        canSubmit={trimmed.length > 0 && !isRunning}
        placeholder={hasSubmitted ? 'Ask for another change…' : 'Describe your workflow…'}
        inputTestId="workflow-builder-conversation-input"
        submitTestId="workflow-builder-conversation-submit"
      />
    </div>
  );
}
