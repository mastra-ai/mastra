import {
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  ToolCallContentPartComponent,
} from '@assistant-ui/react';
import { ArrowDownIcon, ArrowUp, PencilIcon, SendHorizontalIcon } from 'lucide-react';
import type { FC } from 'react';

import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

import { AssistantMessage } from './assistant-message';
import { UserMessage } from './user-message';

const suggestions = ['What capabilities do you have?', 'How can you help me?', 'Tell me about yourself'];

export const Thread: FC<{ memory?: boolean; ToolFallback?: ToolCallContentPartComponent }> = ({
  memory,
  ToolFallback,
}) => {
  function WrappedAssistantMessage(props: MessagePrimitive.Root.Props) {
    return <AssistantMessage {...props} ToolFallback={ToolFallback} />;
  }

  return (
    <ThreadPrimitive.Root
      style={{
        margin: '0 auto',
      }}
      className="bg-background  flex flex-col box-border relative h-full"
    >
      <ThreadPrimitive.Viewport
        style={{
          paddingTop: '2rem',
          background: 'inherit',
          scrollBehavior: 'smooth',
          overflowY: 'scroll',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          height: memory ? 'calc(100vh - 65px)' : 'calc(100vh - 90px)',
          paddingBottom: '108px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '48rem', paddingInline: '1.5rem' }}>
          <ThreadWelcome />
          <ThreadPrimitive.Messages
            components={{
              UserMessage: UserMessage,
              EditComposer: EditComposer,
              AssistantMessage: WrappedAssistantMessage,
            }}
          />
        </div>

        <ThreadPrimitive.If empty={false}>
          <div className="min-h-8 flex-grow" />
        </ThreadPrimitive.If>
      </ThreadPrimitive.Viewport>
      <div
        style={{
          width: '100%',
          maxWidth: '48rem',
          position: 'absolute',
          bottom: 0,
          margin: '0 auto',
          zIndex: 10,
          paddingBottom: '0.5em',
          left: '50%',
          transform: 'translate(-50%)',
          background: '#0f0f0f',
        }}
        className="px-4"
      >
        <div className="flex flex-col gap-2">
          <ThreadPrimitive.Empty>
            <ThreadWelcomeSuggestions />
          </ThreadPrimitive.Empty>
          <Composer />
          {!memory && (
            <div className="flex items-center gap-1 text-sm text-mastra-el-5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-purple-400"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span className="text-xs text-gray-300/60">
                Agent will not remember previous messages. To enable memory for agent see{' '}
                <a
                  href="https://mastra.ai/docs/agents/01-agent-memory"
                  target="_blank"
                  rel="noopener"
                  className="text-gray-300/60 hover:text-gray-100 underline"
                >
                  docs.
                </a>
              </span>
            </div>
          )}
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
      <div
        style={{
          maxWidth: '48rem',
          margin: '0 auto',
        }}
        className="max-w-[48rem] flex w-full flex-grow flex-col"
      >
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
          <span className="line-clamp-2 text-ellipsis text-sm font-medium">{suggestion}</span>
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
        background: '#0f0f0f',
        boxShadow: '0px 8px 0px 0px #0f0f0f',
      }}
      className="relative focus-within:border-ring/20 flex w-full flex-wrap items-end border bg-inherit px-2.5 shadow-sm transition-colors ease-in"
    >
      <ComposerPrimitive.Input asChild>
        <textarea
          style={{
            height: '98px',
          }}
          className="placeholder:text-muted-foreground max-h-40 w-full flex-grow resize-none border-none bg-transparent px-2 py-4 text-sm outline-none focus:ring-0 disabled:cursor-not-allowed"
          autoFocus
          placeholder="Write a message..."
          name=""
          id=""
        ></textarea>
      </ComposerPrimitive.Input>
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
    <ComposerPrimitive.Root
      style={{
        maxWidth: '48rem',
        margin: '0 auto',
      }}
      className="bg-muted max-w-[48rem] my-4 flex w-full flex-col gap-2 rounded-xl"
    >
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
