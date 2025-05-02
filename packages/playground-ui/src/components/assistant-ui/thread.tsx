import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  ToolCallContentPartComponent,
} from '@assistant-ui/react';
import { ArrowUp } from 'lucide-react';
import type { FC } from 'react';

import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

import { AssistantMessage } from './assistant-message';
import { UserMessage } from './user-message';
import { useRef } from 'react';
import { useAutoscroll } from '@/hooks/use-autoscroll';

export interface ThreadProps {
  ToolFallback?: ToolCallContentPartComponent;
  agentName?: string;
}

export const Thread = ({ ToolFallback, agentName }: ThreadProps) => {
  const areaRef = useRef<HTMLDivElement>(null);
  useAutoscroll(areaRef, { enabled: true });

  const WrappedAssistantMessage = (props: MessagePrimitive.Root.Props) => {
    return <AssistantMessage {...props} ToolFallback={ToolFallback} />;
  };

  return (
    <ThreadPrimitive.Root className="max-w-[568px] w-full mx-auto h-[calc(100%-100px)] px-4">
      <ThreadPrimitive.Viewport className="py-10 overflow-y-auto scroll-smooth h-full" ref={areaRef} autoScroll={false}>
        <div>
          <ThreadWelcome agentName={agentName} />
          <ThreadPrimitive.Messages
            components={{
              UserMessage: UserMessage,
              EditComposer: EditComposer,
              AssistantMessage: WrappedAssistantMessage,
            }}
          />
        </div>

        <ThreadPrimitive.If empty={false}>
          <div />
        </ThreadPrimitive.If>
      </ThreadPrimitive.Viewport>

      <Composer />
    </ThreadPrimitive.Root>
  );
};

export interface ThreadWelcomeProps {
  agentName?: string;
}

const ThreadWelcome = ({ agentName }: ThreadWelcomeProps) => {
  const safeAgentName = agentName ?? '';
  const words = safeAgentName.split(' ') ?? [];

  let initials = 'A';

  if (words.length === 2) {
    initials = `${words[0][0]}${words[1][0]}`;
  } else if (safeAgentName.length > 0) {
    initials = `${safeAgentName[0]}`;
  } else {
    initials = 'A';
  }

  return (
    <ThreadPrimitive.Empty>
      <div className="flex w-full flex-grow flex-col items-center justify-center">
        <Avatar>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <p className="mt-4 font-medium">How can I help you today?</p>
      </div>
    </ThreadPrimitive.Empty>
  );
};

const Composer: FC = () => {
  return (
    <ComposerPrimitive.Root className="w-full bg-surface3 rounded-lg border-sm border-border1 px-3 py-4 mt-auto h-[100px]">
      <ComposerPrimitive.Input asChild className="w-full">
        <textarea
          className="text-ui-lg leading-ui-lg placeholder:text-icon3 text-icon6 bg-transparent focus:outline-none resize-none"
          autoFocus
          placeholder="Enter your message..."
          name=""
          id=""
        ></textarea>
      </ComposerPrimitive.Input>
      <div className="flex justify-end">
        <ComposerAction />
      </div>
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
            className="rounded-full border-sm border-[#363636] bg-[#292929]"
          >
            <ArrowUp className="h-6 w-6 text-[#898989] hover:text-[#fff]" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <TooltipIconButton tooltip="Cancel" variant="default">
            <CircleStopIcon />
          </TooltipIconButton>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </>
  );
};

const EditComposer: FC = () => {
  return (
    <ComposerPrimitive.Root>
      <ComposerPrimitive.Input />

      <div>
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
