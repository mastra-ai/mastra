'use client';

import { MastraReactProvider, MastraUIMessage, toNetworkUIMessage, useChat } from '@mastra/react';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { MessageSquare } from 'lucide-react';
import {
  PromptInput,
  PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { FormEvent, useState } from 'react';
import { Response } from '@/components/ai-elements/response';
import { PlaygroundQueryClient } from '@mastra/playground-ui';

function HomeInner() {
  const [input, setInput] = useState('');
  const { messages, setMessages, network, isRunning } = useChat<MastraUIMessage>({
    agentId: 'networkAgent',
  });

  const handleSubmit = (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inputData.trim()) {
      setMessages([
        {
          role: 'user',
          parts: [{ type: 'text', text: input }],
          id: 'init',
        },
      ]);

      network({
        coreUserMessages: [
          {
            role: 'user',
            content: input,
          },
        ],
        onNetworkChunk: (chunk, conversation) => {
          return toNetworkUIMessage({ chunk, conversation });
        },
      });

      setInput('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full rounded-lg border h-[600px]">
      <div className="flex flex-col h-full">
        <Conversation>
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessageSquare className="size-12" />}
                title="Start a conversation"
                description="Type a message below to begin chatting"
              />
            ) : (
              messages.map(message => (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    {message.parts.map((part, i) => {
                      switch (part.type) {
                        case 'text': // we don't use any reasoning or tool calls in this example
                          return <Response key={`${message.id}-${i}`}>{part.text}</Response>;
                        case 'dynamic-tool': {
                          return (
                            <pre
                              key={`${message.id}-${i}`}
                              className="block w-full flex-1 shrink-0"
                              style={{ width: '600px' }}
                            >
                              {JSON.stringify(part.output, null, 2)}
                            </pre>
                          );
                        }
                        default:
                          return null;
                      }
                    })}
                  </MessageContent>
                </Message>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput onSubmit={handleSubmit} className="mt-4 w-full max-w-2xl mx-auto relative">
          <PromptInputTextarea
            value={input}
            placeholder="Say something..."
            onChange={e => setInput(e.currentTarget.value)}
            className="pr-12"
          />
          <PromptInputSubmit
            status={isRunning ? 'streaming' : 'ready'}
            disabled={!inputData.trim()}
            className="absolute bottom-1 right-1"
          />
        </PromptInput>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <PlaygroundQueryClient>
      <MastraReactProvider baseUrl="http://localhost:4111">
        <HomeInner />
      </MastraReactProvider>
    </PlaygroundQueryClient>
  );
}
