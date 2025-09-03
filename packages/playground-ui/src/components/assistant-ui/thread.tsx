import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  ToolCallMessagePartComponent,
  useComposerRuntime,
} from '@assistant-ui/react';
import { ArrowUp, Mic, PlusIcon } from 'lucide-react';

import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

import { AssistantMessage } from './messages/assistant-message';
import { UserMessage } from './messages/user-messages';
import { useEffect, useRef } from 'react';
import { useAutoscroll } from '@/hooks/use-autoscroll';
import { Txt } from '@/ds/components/Txt';
import { Icon, InfoIcon } from '@/ds/icons';
import { useSpeechRecognition } from '@/domains/voice/hooks/use-speech-recognition';
import { ComposerAttachments } from './attachments/attachment';

export interface ThreadProps {
  ToolFallback?: ToolCallMessagePartComponent;
  agentName?: string;
  agentId?: string;
  hasMemory?: boolean;
  onInputChange?: (value: string) => void;
}

export const Thread = ({ ToolFallback, agentName, agentId, hasMemory, onInputChange }: ThreadProps) => {
  const areaRef = useRef<HTMLDivElement>(null);
  useAutoscroll(areaRef, { enabled: true });

  const WrappedAssistantMessage = (props: MessagePrimitive.Root.Props) => {
    return <AssistantMessage {...props} ToolFallback={ToolFallback} />;
  };

  return (
    <ThreadWrapper>
      <ThreadPrimitive.Viewport ref={areaRef} autoScroll={false} className="overflow-y-scroll scroll-smooth h-full">
        <ThreadWelcome agentName={agentName} />

        <div className="max-w-[568px] w-full mx-auto px-4 pb-7">
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

      <Composer hasMemory={hasMemory} onInputChange={onInputChange} agentId={agentId} />
    </ThreadWrapper>
  );
};

const ThreadWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThreadPrimitive.Root className="grid grid-rows-[1fr_auto] h-full overflow-y-auto">{children}</ThreadPrimitive.Root>
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

interface ComposerProps {
  hasMemory?: boolean;
  onInputChange?: (value: string) => void;
  agentId?: string;
}

const Composer = ({ hasMemory, onInputChange, agentId }: ComposerProps) => {
  return (
    <div className="mx-4">
      <ComposerPrimitive.Root>
        <div className="max-w-[568px] w-full mx-auto pb-2">
          <ComposerAttachments />
        </div>

        <div className="bg-surface3 rounded-lg border-sm border-border1 py-4 mt-auto max-w-[568px] w-full mx-auto px-4 focus-within:outline focus-within:outline-accent1 -outline-offset-2">
          <ComposerPrimitive.Input asChild className="w-full">
            <textarea
              className="text-ui-lg leading-ui-lg placeholder:text-icon3 text-icon6 bg-transparent focus:outline-none resize-none outline-none"
              autoFocus
              placeholder="Enter your message..."
              name=""
              id=""
              onChange={e => onInputChange?.(e.target.value)}
            ></textarea>
          </ComposerPrimitive.Input>
          <div className="flex justify-end gap-2">
            <SpeechInput agentId={agentId} />
            <ComposerAction />
          </div>
        </div>
      </ComposerPrimitive.Root>

      {!hasMemory && (
        <Txt variant="ui-sm" className="text-icon3 flex gap-2 pt-1 max-w-[568px] w-full mx-auto border-t items-start">
          <Icon className="transform translate-y-[0.1rem]">
            <InfoIcon />
          </Icon>
          Memory is not enabled. The conversation will not be persisted.
        </Txt>
      )}
    </div>
  );
};

const SpeechInput = ({ agentId }: { agentId?: string }) => {
  const composerRuntime = useComposerRuntime();
  const { start, stop, isListening, transcript } = useSpeechRecognition({ agentId });

  useEffect(() => {
    if (!transcript) return;

    composerRuntime.setText(transcript);
  }, [composerRuntime, transcript]);

  return (
    <TooltipIconButton
      type="button"
      tooltip={isListening ? 'Stop dictation' : 'Start dictation'}
      variant="ghost"
      className="rounded-full"
      onClick={() => (isListening ? stop() : start())}
    >
      {isListening ? <CircleStopIcon /> : <Mic className="h-6 w-6 text-[#898989] hover:text-[#fff]" />}
    </TooltipIconButton>
  );
};

const ComposerAction = () => {
  return (
    <>
      <ComposerPrimitive.AddAttachment asChild>
        <TooltipIconButton tooltip="Add attachment" variant="ghost" className="rounded-full">
          <PlusIcon className="h-6 w-6 text-[#898989] hover:text-[#fff]" />
        </TooltipIconButton>
      </ComposerPrimitive.AddAttachment>

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

const EditComposer = () => {
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
