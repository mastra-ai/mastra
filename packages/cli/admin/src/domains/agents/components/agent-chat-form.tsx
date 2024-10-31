'use client';

import { SetStateAction, useEffect, useRef, type RefObject } from 'react';

import { useParams } from 'next/navigation';

import Icon from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { sendAgentMessage } from './actions';
import { Message } from './chat-list';

export function useEnterSubmit(): {
  formRef: RefObject<HTMLFormElement | null>;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
} {
  const formRef = useRef<HTMLFormElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      formRef.current?.requestSubmit();
      event.preventDefault();
    }
  };

  return { formRef, onKeyDown: handleKeyDown };
}

interface AgentChatForm {
  input: string;
  setInput: (value: string) => void;
  setMessages: React.Dispatch<SetStateAction<Message[]>>;
  threadId: string;
  setThreadId: React.Dispatch<SetStateAction<string>>;
}

export const AgentChatForm = ({ input, setInput, threadId, setThreadId, setMessages }: AgentChatForm) => {
  const { formRef, onKeyDown } = useEnterSubmit();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const params = useParams();

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className="space-y-4 border-t bg-mastra-bg-1/50 px-4 py-2 shadow-lg sm:rounded-t-xl border-[0.5px] md:py-4">
      <form
        ref={formRef}
        onSubmit={async (e: any) => {
          e.preventDefault();

          // Blur focus on mobile
          if (window.innerWidth < 600) {
            e.target['message']?.blur();
          }

          const value = input.trim();

          setInput('');

          if (!value) return;

          // Optimistically add user message UI
          setMessages(prev => [...prev, { id: crypto.randomUUID(), text: value, role: 'user' }]);
          const messageId = crypto.randomUUID();
          setMessages(prev => [...prev, { id: messageId, role: 'assistant', text: '' }]);
          const message = await sendAgentMessage({
            messageId,
            message: value,
            assistant: params.id as string,
            threadId,
          });

          setThreadId(message.threadId!);

          setMessages(prev =>
            prev.map(m => {
              if (m.id === messageId) {
                return {
                  ...m,
                  text: message.display,
                };
              }
              return m;
            }),
          );
        }}
      >
        <div className="relative flex max-h-60 w-full grow flex-col overflow-hidden bg-mastra-bg-2 sm:rounded-md py-2 border-[0.5px]">
          <Textarea
            variant="ghost"
            size="lg"
            ref={inputRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            placeholder="Message agent"
            className="min-h-[60px] font-mono focus-visible:ring-transparent focus-visible:outline-none w-full resize-none bg-transparent px-4 pr-14 py-[1.3rem] focus-within:outline-none sm:text-sm"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            name="message"
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <div className="absolute right-0 top-[25%] sm:right-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="p-0 bg-mastra-bg-5"
                  type="submit"
                  size="icon"
                  disabled={input === ''}
                >
                  <Icon name="arrow-enter" />
                  <span className="sr-only">Message agent</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Message agent</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </form>
    </div>
  );
};
