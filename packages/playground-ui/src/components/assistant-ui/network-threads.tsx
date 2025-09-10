import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  ToolCallMessagePartComponent,
  useComposerRuntime,
} from '@assistant-ui/react';
import { ArrowUp, Mic, PlusIcon } from 'lucide-react';
import type { FC } from 'react';

import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

import { UserMessage } from './messages/user-messages';
import { useEffect, useRef } from 'react';
import { useAutoscroll } from '@/hooks/use-autoscroll';
import { Txt } from '@/ds/components/Txt';
import { Icon, InfoIcon } from '@/ds/icons';
import { useSpeechRecognition } from '@/domains/voice/hooks/use-speech-recognition';
import { ComposerAttachments } from './attachments/attachment';
import { useHasAttachments } from './hooks/use-has-attachments';
import { NextAssistantMessage } from '@/domains/networks/v-next/wrapped-assistant-message';
import clsx from 'clsx';

export interface ThreadProps {
  ToolFallback?: ToolCallMessagePartComponent;
  networkName?: string;
  hasMemory?: boolean;
}

export const NetworkThread = ({ ToolFallback, networkName, hasMemory }: ThreadProps) => {
  const areaRef = useRef<HTMLDivElement>(null);
  useAutoscroll(areaRef, { enabled: true });

  const WrappedAssistantMessage = (props: MessagePrimitive.Root.Props) => {
    return <NextAssistantMessage {...props} ToolFallback={ToolFallback} />;
  };

  return (
    <ThreadWrapper>
      <ThreadPrimitive.Viewport className="py-10 overflow-y-auto scroll-smooth h-full" ref={areaRef} autoScroll={false}>
        <div>
          <ThreadWelcome networkName={networkName} />
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

      <Composer hasMemory={hasMemory} />
    </ThreadWrapper>
  );
};

const ThreadWrapper = ({ children }: { children: React.ReactNode }) => {
  const hasAttachments = useHasAttachments();

  return (
    <ThreadPrimitive.Root
      className={clsx(
        'max-w-[568px] w-full mx-auto px-4',
        hasAttachments ? 'h-[calc(100%-208px)]' : 'h-[calc(100%-112px)]',
      )}
    >
      {children}
    </ThreadPrimitive.Root>
  );
};

export interface ThreadWelcomeProps {
  networkName?: string;
}

const ThreadWelcome = ({ networkName }: ThreadWelcomeProps) => {
  const safeNetworkName = networkName ?? '';
  const words = safeNetworkName.split(' ') ?? [];

  let initials = 'A';

  if (words.length === 2) {
    initials = `${words[0][0]}${words[1][0]}`;
  } else if (safeNetworkName.length > 0) {
    initials = `${safeNetworkName[0]}`;
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

const Composer: FC<{ hasMemory?: boolean }> = ({ hasMemory }) => {
  return (
    <div>
      <ComposerPrimitive.Root>
        <ComposerAttachments />

        <div className="w-full bg-surface3 rounded-lg border-sm border-border1 px-3 py-4 mt-auto h-[100px]">
          <ComposerPrimitive.Input asChild className="w-full">
            <textarea
              className="text-ui-lg leading-ui-lg placeholder:text-icon3 text-icon6 bg-transparent resize-none"
              autoFocus
              placeholder="Enter your message..."
              name=""
              id=""
            ></textarea>
          </ComposerPrimitive.Input>
          <div className="flex justify-end gap-2">
            <SpeechInput />
            <ComposerAction />
          </div>
        </div>
      </ComposerPrimitive.Root>

      {!hasMemory && (
        <Txt variant="ui-sm" className="text-icon3 flex items-center gap-2 pt-0.5">
          <Icon>
            <InfoIcon />
          </Icon>
          Memory is not enabled. The conversation will not be persisted.
        </Txt>
      )}
    </div>
  );
};

const SpeechInput = () => {
  const composerRuntime = useComposerRuntime();
  const { start, stop, isListening, transcript } = useSpeechRecognition({});

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

const ComposerAction: FC = () => {
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
