'use client';

import { MastraReactProvider, useChat, MessageList, Message, MessageActions, IconButton } from '@mastra/react';
import '@mastra/react/styles.css';

import {
  PromptInput,
  PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { FormEvent, useState } from 'react';
import { TextMessage } from '@/components/mastra-components/TextMessage';
import { Tool } from '@/components/mastra-components/Tool';
import { ToolWorkflow } from '@/components/mastra-components/ToolWorkflow';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function HomeInner() {
  const [input, setInput] = useState('');

  const { messages, sendMessage, isRunning } = useChat({
    agentId: 'chefModelV2Agent',
  });

  const handleSubmit = (_: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    sendMessage({ message: input });

    setInput('');
  };

  return (
    <div className="max-w-[80vh] mx-auto h-[80vh] ">
      <div className="flex flex-col h-full">
        <MessageList>
          {messages.map(message => {
            const isStreaming = message.role === 'assistant' && isRunning;
            const position = message.role === 'user' ? 'right' : 'left';

            return message.parts.map((part, index) => {
              if (part.type === 'text') {
                return (
                  <Message key={message.id + index} position={position}>
                    <TextMessage role={message.role} isStreaming={isStreaming} message={part.text} />
                  </Message>
                );
              }

              if (part.type === 'dynamic-tool') {
                if (part.toolName.startsWith('workflow')) {
                  return (
                    <Message key={message.id + index} position={position}>
                      <ToolWorkflow
                        workflowId={part.toolName}
                        input={part.input as Record<string, any>}
                        output={part.output as Record<string, any>}
                      />
                    </Message>
                  );
                }

                return (
                  <Message key={message.id + index} position={position}>
                    <Tool
                      toolName={part.toolName}
                      input={part.input as Record<string, any>}
                      output={part.output as Record<string, any>}
                    />
                  </Message>
                );
              }

              return null;
            });
          })}
        </MessageList>

        <PromptInput onSubmit={handleSubmit} className="mt-4 w-full max-w-2xl mx-auto relative">
          <PromptInputTextarea
            value={input}
            placeholder="Say something..."
            onChange={e => setInput(e.currentTarget.value)}
            className="pr-12"
          />
          <PromptInputSubmit
            status={isRunning ? 'streaming' : 'ready'}
            disabled={!input.trim()}
            className="absolute bottom-1 right-1"
          />
        </PromptInput>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <MastraReactProvider baseUrl="http://localhost:4111">
        <HomeInner />
      </MastraReactProvider>
    </QueryClientProvider>
  );
}
