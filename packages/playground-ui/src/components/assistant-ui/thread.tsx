import { ActionBarPrimitive, ComposerPrimitive, ThreadPrimitive } from '@assistant-ui/react';
import { ArrowDownIcon, ArrowUp, PencilIcon, SendHorizontalIcon } from 'lucide-react';
import type { FC } from 'react';

import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

import { AssistantMessage } from './assistant-message';
import { UserMessage } from './user-message';

const suggestions = ['What capabilities do you have?', 'How can you help me?', 'Tell me about yourself'];

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root
      className="bg-background flex flex-col box-border relative h-full"
      style={{
        ['--thread-max-width' as string]: '42rem',
      }}
    >
      <ThreadPrimitive.Viewport
        style={{
          paddingTop: '2rem',
          paddingInline: '1rem',
          background: 'inherit',
          scrollBehavior: 'smooth',
          overflowY: 'scroll',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          height: '100%',
          flexGrow: 1,
        }}
      >
        <ThreadWelcome />
        <ThreadPrimitive.Messages
          components={{
            UserMessage: UserMessage,
            EditComposer: EditComposer,
            AssistantMessage: AssistantMessage,
          }}
        />

        <ThreadPrimitive.If empty={false}>
          <div className="min-h-8 flex-grow" />
        </ThreadPrimitive.If>
      </ThreadPrimitive.Viewport>
      <div className="max-w-[var(--thread-max-width)] bg-[#0f0f0f] px-4">
        <div className="flex flex-col gap-2">
          <ThreadWelcomeSuggestions />
          <Composer />
        </div>
      </div>
    </ThreadPrimitive.Root>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="absolute -top-8 rounded-full disabled:invisible"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <ThreadPrimitive.Empty>
      <div className="max-w-[var(--thread-max-width)] flex w-full flex-grow flex-col">
        <div className="flex w-full flex-grow flex-col items-center justify-center">
          <Avatar>
            <AvatarFallback>C</AvatarFallback>
          </Avatar>
          <p className="mt-4 font-medium">How can I help you today?</p>
        </div>
      </div>
    </ThreadPrimitive.Empty>
  );
};

const ThreadWelcomeSuggestions: FC = () => {
  return (
    <div className="mt-3 flex w-full items-stretch justify-center gap-4">
      {suggestions.map(suggestion => (
        <ThreadPrimitive.Suggestion
          key={suggestion}
          className="hover:bg-muted/80 flex max-w-sm grow basis-0 flex-col items-center justify-center rounded-lg border p-3 transition-colors ease-in"
          prompt={suggestion}
          method="replace"
          autoSend
        >
          <span className="line-clamp-2 text-ellipsis text-sm font-semibold">{suggestion}</span>
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  );
};

const Composer: FC = () => {
  return (
    <ComposerPrimitive.Root
      style={{
        borderRadius: '16px',
      }}
      className="relative focus-within:border-ring/20 flex w-full flex-wrap items-end border bg-inherit px-2.5 shadow-sm transition-colors ease-in"
    >
      <ComposerPrimitive.Input
        rows={1}
        autoFocus
        placeholder="Write a message..."
        className="placeholder:text-muted-foreground max-h-40 w-3/4 flex-grow resize-none border-none bg-transparent px-2 py-4 text-sm outline-none focus:ring-0 disabled:cursor-not-allowed"
      />
      <ComposerAction />
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC = () => {
  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send"
            variant="default"
            style={{
              marginBottom: '0.625rem',
              position: 'absolute',
              right: '0.75rem',
              height: '2rem',
              width: '2rem',
              borderRadius: '50%',
              padding: '0.5rem',
              transition: 'opacity 0.2s ease-in',
            }}
          >
            <ArrowUp className="h-6 w-6" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <TooltipIconButton
            tooltip="Cancel"
            variant="default"
            style={{
              marginBottom: '0.625rem',
              position: 'absolute',
              right: '0.75rem',
              height: '2rem',
              width: '2rem',
              padding: '0.5rem',
              transition: 'opacity 0.2s ease-in',
              borderRadius: '50%',
            }}
          >
            <CircleStopIcon />
          </TooltipIconButton>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex flex-col items-end col-start-1 row-start-2 mr-3 mt-2.5"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <ComposerPrimitive.Root className="bg-muted max-w-[var(--thread-max-width)] my-4 flex w-full flex-col gap-2 rounded-xl">
      <ComposerPrimitive.Input className="text-foreground flex h-8 w-full resize-none bg-transparent p-4 pb-0 outline-none" />

      <div className="mx-3 mb-3 flex items-center justify-center gap-2 self-end">
        <ComposerPrimitive.Cancel asChild>
          <Button variant="ghost">Cancel</Button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <Button>Send</Button>
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
};

const CircleStopIcon = () => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
      <rect width="10" height="10" x="3" y="3" rx="2" />
    </svg>
  );
};
