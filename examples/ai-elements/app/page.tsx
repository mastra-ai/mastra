'use client';

import {
  MastraReactProvider,
  useChat,
  MessageList,
  Message,
  MessageContent,
  Entity,
  EntityContent,
  EntityTrigger,
  EntityCaret,
  Icon,
  Entry,
  EntryTitle,
  CodeBlock,
  CodeCopyButton,
  ToolsIcon,
  MessageUsage,
  MessageUsageEntry,
  MessageUsageValue,
  MessageUsages,
  MessageActions,
  IconButton,
} from '@mastra/react';
import '@mastra/react/styles.css';

import {
  PromptInput,
  PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { FormEvent, useState } from 'react';
import { Copy, Hash, Mic } from 'lucide-react';

function HomeInner() {
  const [input, setInput] = useState('');
  const { messages, setMessages, stream, isRunning } = useChat({
    agentId: 'chefModelV2Agent',
  });

  const handleSubmit = (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inputData.trim()) {
      setMessages(state => [
        ...state,
        {
          role: 'user',
          parts: [{ type: 'text', text: input }],
          id: 'init',
        },
      ]);

      stream({
        coreUserMessages: [
          {
            role: 'user',
            content: input,
          },
        ],
      });

      setInput('');
    }
  };

  return (
    <div className="max-w-[80vh] mx-auto h-[80vh] ">
      <div className="flex flex-col h-full">
        <MessageList>
          {messages.map(message => {
            const isStreaming = message.role === 'assistant' && isRunning;
            const position = message.role === 'user' ? 'right' : 'left';

            return message.parts.map((part, index) => (
              <Message key={message.id + index} position={position}>
                {part.type === 'text' ? (
                  <>
                    {message.role === 'assistant' && (
                      <MessageUsages>
                        <MessageUsage>
                          <MessageUsageEntry>
                            <Icon>
                              <Hash />
                            </Icon>
                            Tokens:
                          </MessageUsageEntry>
                          <MessageUsageValue>100</MessageUsageValue>
                        </MessageUsage>
                      </MessageUsages>
                    )}
                    <MessageContent isStreaming={isStreaming}>{part.text}</MessageContent>
                  </>
                ) : part.type === 'dynamic-tool' ? (
                  <Entity key={message.id + index} variant="tool">
                    <EntityTrigger>
                      <Icon>
                        <ToolsIcon />
                      </Icon>
                      {part.toolName}
                      <EntityCaret />
                    </EntityTrigger>

                    <EntityContent>
                      <Entry>
                        <EntryTitle>Tool input</EntryTitle>
                        <CodeBlock
                          code={JSON.stringify(part.input, null, 2)}
                          language="json"
                          cta={<CodeCopyButton code={JSON.stringify(part.input, null, 2)} />}
                        />
                      </Entry>

                      <Entry>
                        <EntryTitle>Tool output</EntryTitle>
                        <CodeBlock
                          cta={<CodeCopyButton code={JSON.stringify(part.output, null, 2)} />}
                          code={JSON.stringify(part.output, null, 2)}
                          language="json"
                        />
                      </Entry>
                    </EntityContent>
                  </Entity>
                ) : null}
                <MessageActions>
                  <IconButton tooltip="Voice message">
                    <Mic />
                  </IconButton>

                  <IconButton tooltip="Copy">
                    <Copy />
                  </IconButton>
                </MessageActions>
              </Message>
            ));
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
    <MastraReactProvider baseUrl="http://localhost:4111">
      <HomeInner />
    </MastraReactProvider>
  );
}
