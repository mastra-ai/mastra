'use client';

import { useChat } from '@ai-sdk/react';
import { AiMessageType as Message } from '@mastra/core';
import { useSWRConfig } from 'swr';

import { ChatHeader } from '@/components/chat-header';
import { generateUUID } from '@/lib/utils';

import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { toast } from 'sonner';

export function Chat({
  id,
  initialMessages,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<Message>;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();

  const { messages, setMessages, handleSubmit, input, setInput, append, isLoading, stop } = useChat({
    id,
    body: { id },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    onFinish: () => {
      setTimeout(() => {
        mutate('/api/threads');
      }, 500);
    },
    onError: error => {
      toast.error('An error occured, please try again!');
      console.log(error);
    },
  });

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader />

        <Messages isLoading={isLoading} messages={messages} isReadonly={isReadonly} />

        <form className="flex mt-4 mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              isLoading={isLoading}
              stop={stop}
              messages={messages}
              setMessages={setMessages}
              append={append}
            />
          )}
        </form>
      </div>
    </>
  );
}
