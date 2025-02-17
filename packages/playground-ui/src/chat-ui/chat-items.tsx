import { ArrowDown, ThumbsDown, ThumbsUp } from 'lucide-react';
import React, { forwardRef, useCallback, useState, type ReactElement } from 'react';

import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

import { type Message } from './chat-message';
import { CopyButton } from './copy-button';
import { useAutoScroll } from './hooks/use-auto-scroll';
import { MessageInput } from './message-input';
import { MessageList } from './message-list';
import { PromptSuggestions } from './prompt-suggestions';

interface ChatPropsBase {
  handleSubmit: (event?: { preventDefault?: () => void }, options?: { experimental_attachments?: FileList }) => void;
  messages: Array<Message>;
  input: string;
  className?: string;
  handleInputChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  isGenerating: boolean;
  stop?: () => void;
  onRateResponse?: (messageId: string, rating: 'thumbs-up' | 'thumbs-down') => void;
}

interface ChatPropsWithoutSuggestions extends ChatPropsBase {
  append?: never;
  suggestions?: never;
}

interface ChatPropsWithSuggestions extends ChatPropsBase {
  append: (message: { role: 'user'; content: string }) => void;
  suggestions: string[];
}

type ChatProps = ChatPropsWithoutSuggestions | ChatPropsWithSuggestions;

export function Chat({
  messages,
  handleSubmit,
  input,
  handleInputChange,
  stop,
  isGenerating,
  append,
  suggestions,
  className,
  onRateResponse,
}: ChatProps) {
  const lastMessage = messages.at(-1);
  const isEmpty = messages.length === 0;
  const isTyping = lastMessage?.role === 'user';

  const messageOptions = useCallback(
    (message: Message) => ({
      actions: onRateResponse ? (
        <>
          <div className="border-r pr-1">
            <CopyButton content={message.content} copyMessage="Copied response to clipboard!" />
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onRateResponse(message.id!, 'thumbs-up')}
          >
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onRateResponse(message.id!, 'thumbs-down')}
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <CopyButton content={message.content} copyMessage="Copied response to clipboard!" />
      ),
    }),
    [onRateResponse],
  );

  return (
    <ChatContainer className={className}>
      {isEmpty && append && suggestions ? (
        <PromptSuggestions label="Try these prompts ✨" append={append} suggestions={suggestions} />
      ) : null}

      {messages.length > 0 ? (
        <ChatMessages messages={messages}>
          <MessageList messages={messages} isTyping={isTyping} messageOptions={messageOptions} />
        </ChatMessages>
      ) : null}

      <ChatForm className="mt-auto" isPending={isGenerating || isTyping} handleSubmit={handleSubmit}>
        {({ files, setFiles }) => (
          <MessageInput
            value={input}
            onChange={handleInputChange}
            allowAttachments
            files={files}
            setFiles={setFiles}
            stop={stop}
            isGenerating={isGenerating}
          />
        )}
      </ChatForm>
    </ChatContainer>
  );
}
Chat.displayName = 'Chat';

export function ChatMessages({
  messages,
  children,
}: React.PropsWithChildren<{
  messages: Message[];
}>) {
  const { scrollToBottom, shouldAutoScroll } = useAutoScroll([messages]);

  return (
    <div className="h-full overflow-y-scroll pb-4">
      {children}

      <div className="flex flex-1 items-end justify-end [grid-column:1/1] [grid-row:1/1]">
        {!shouldAutoScroll && (
          <div className="sticky bottom-0 left-0 flex w-full justify-end">
            <Button
              onClick={scrollToBottom}
              className="animate-in fade-in-0 slide-in-from-bottom-1 h-8 w-8 rounded-full ease-in-out"
              size="icon"
              variant="ghost"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export const ChatContainer = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn('w-full', className)} {...props} />;
  },
);
ChatContainer.displayName = 'ChatContainer';

interface ChatFormProps {
  className?: string;
  isPending: boolean;
  handleSubmit: (event?: { preventDefault?: () => void }, options?: { experimental_attachments?: FileList }) => void;
  children: (props: {
    files: File[] | null;
    setFiles: React.Dispatch<React.SetStateAction<File[] | null>>;
  }) => ReactElement;
}

export const ChatForm = forwardRef<HTMLFormElement, ChatFormProps>(
  ({ children, handleSubmit, isPending, className }, ref) => {
    const [files, setFiles] = useState<File[] | null>(null);

    const onSubmit = (event: React.FormEvent) => {
      if (isPending) {
        event.preventDefault();
        return;
      }

      if (!files) {
        handleSubmit(event);
        return;
      }

      const fileList = createFileList(files);
      handleSubmit(event, { experimental_attachments: fileList });
      setFiles(null);
    };

    return (
      <form ref={ref} onSubmit={onSubmit} className={className}>
        {children({ files, setFiles })}
      </form>
    );
  },
);
ChatForm.displayName = 'ChatForm';

function createFileList(files: File[] | FileList): FileList {
  const dataTransfer = new DataTransfer();
  for (const file of Array.from(files)) {
    dataTransfer.items.add(file);
  }
  return dataTransfer.files;
}
