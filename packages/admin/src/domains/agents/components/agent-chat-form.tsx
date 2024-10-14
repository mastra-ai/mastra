'use client';

import { SetStateAction, useEffect, useRef, type RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import Icon from '@/app/components/icon';

import { Message } from './chat-list';

export function useEnterSubmit(): {
  formRef: RefObject<HTMLFormElement>;
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
}

export const AgentChatForm = ({ input, setInput, setMessages }: AgentChatForm) => {
  const { formRef, onKeyDown } = useEnterSubmit();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  return (
    <div className="space-y-4 border-t bg-mastra-bg-1 px-4 py-2 shadow-lg sm:rounded-t-xl border-[0.5px] md:py-4">
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
          setMessages(prev => [...prev, { id: crypto.randomUUID(), text: value }]);
        }}
      >
        <div className="relative flex max-h-60 w-full grow flex-col overflow-hidden bg-mastra-bg-2 sm:rounded-md py-2 border-[0.5px]">
          <Textarea
            variant="ghost"
            size="lg"
            ref={inputRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            placeholder="Send a message."
            className="min-h-[60px] font-mono focus-visible:ring-transparent focus-visible:outline-none w-full resize-none bg-transparent px-4 py-[1.3rem] focus-within:outline-none sm:text-sm"
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
                <Button className="p-0" type="submit" size="icon" disabled={input === ''}>
                  <Icon name="arrow-enter" />
                  <span className="sr-only">Send message</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send message</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </form>
    </div>
  );
};
