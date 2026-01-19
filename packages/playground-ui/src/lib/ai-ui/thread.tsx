import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  ToolCallMessagePartComponent,
  useComposerRuntime,
} from '@assistant-ui/react';
import { ArrowUp, Mic, PlusIcon } from 'lucide-react';

import { TooltipIconButton } from './tooltip-icon-button';
import { Avatar } from '@/ds/components/Avatar';

import { AssistantMessage } from './messages/assistant-message';
import { UserMessage } from './messages/user-messages';
import { useEffect, useRef, useState } from 'react';
import { useAutoscroll } from '@/hooks/use-autoscroll';

import { useSpeechRecognition } from '@/domains/voice/hooks/use-speech-recognition';
import { ComposerAttachments } from './attachments/attachment';
import { AttachFileDialog } from './attachments/attach-file-dialog';
import { useThreadInput } from '@/domains/conversation';

export interface ThreadProps {
  agentName?: string;
  agentId?: string;
  hasMemory?: boolean;
  hasModelList?: boolean;
}

export const Thread = ({ agentName, agentId, hasMemory, hasModelList }: ThreadProps) => {
  const areaRef = useRef<HTMLDivElement>(null);
  useAutoscroll(areaRef, { enabled: true });

  const WrappedAssistantMessage = (props: MessagePrimitive.Root.Props) => {
    return <AssistantMessage {...props} hasModelList={hasModelList} />;
  };

  return (
    <ThreadWrapper>
      <ThreadPrimitive.Viewport ref={areaRef} autoScroll={false} className="overflow-y-scroll scroll-smooth h-full">
        <ThreadWelcome agentName={agentName} />

        <div className="max-w-3xl w-full mx-auto px-4 pb-7">
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

      <Composer hasMemory={hasMemory} agentId={agentId} />
    </ThreadWrapper>
  );
};

const ThreadWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThreadPrimitive.Root className="grid grid-rows-[1fr_auto] h-full overflow-y-auto" data-testid="thread-wrapper">
      {children}
    </ThreadPrimitive.Root>
  );
};

export interface ThreadWelcomeProps {
  agentName?: string;
}

const ThreadWelcome = ({ agentName }: ThreadWelcomeProps) => {
  return (
    <ThreadPrimitive.Empty>
      <div className="flex w-full flex-grow flex-col items-center justify-center">
        <Avatar name={agentName || 'Agent'} size="lg" />
        <p className="mt-4 font-medium">How can I help you today?</p>
      </div>
    </ThreadPrimitive.Empty>
  );
};

interface ComposerProps {
  hasMemory?: boolean;
  agentId?: string;
}

const Composer = ({ hasMemory, agentId }: ComposerProps) => {
  const { setThreadInput } = useThreadInput();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Only auto-focus on initial mount, not on re-renders
  const shouldAutoFocus = useRef(document?.body && document?.activeElement === document?.body);
  return (
    <div className="mx-4">
      <ComposerPrimitive.Root>
        <div className="max-w-3xl w-full mx-auto pb-2">
          <ComposerAttachments />
        </div>

        <div
          className="bg-surface3 rounded-lg border border-border1 py-4 mt-auto max-w-3xl w-full mx-auto px-4 focus-within:outline focus-within:outline-accent1 -outline-offset-2"
          onClick={() => {
            textareaRef.current?.focus();
          }}
        >
          <ComposerPrimitive.Input asChild className="w-full">
            <textarea
              ref={textareaRef}
              className="text-ui-lg leading-ui-lg placeholder:text-neutral3 text-neutral6 bg-transparent focus:outline-none resize-none outline-none"
              autoFocus={shouldAutoFocus.current}
              placeholder="Enter your message..."
              name=""
              id=""
              onChange={e => setThreadInput?.(e.target.value)}
            />
          </ComposerPrimitive.Input>
          <div className="flex justify-end gap-2">
            <SpeechInput agentId={agentId} />
            <ComposerAction />
          </div>
        </div>
      </ComposerPrimitive.Root>
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
      className="rounded-full"
      onClick={() => (isListening ? stop() : start())}
    >
      {isListening ? <CircleStopIcon /> : <Mic className="h-6 w-6 text-neutral3 hover:text-neutral6" />}
    </TooltipIconButton>
  );
};

const ComposerAction = () => {
  const [isAddAttachmentDialogOpen, setIsAddAttachmentDialogOpen] = useState(false);

  return (
    <>
      <TooltipIconButton
        type="button"
        tooltip="Add attachment"
        className="rounded-full"
        onClick={() => setIsAddAttachmentDialogOpen(true)}
      >
        <PlusIcon className="h-6 w-6 text-neutral3 hover:text-neutral6" />
      </TooltipIconButton>

      <AttachFileDialog open={isAddAttachmentDialogOpen} onOpenChange={setIsAddAttachmentDialogOpen} />

      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send"
            variant="default"
            className="rounded-full border border-border1 bg-surface5"
          >
            <ArrowUp className="h-6 w-6 text-neutral3 hover:text-neutral6" />
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
          <button className="bg-surface2 border border-border1 px-2 text-ui-md inline-flex items-center justify-center rounded-md border h-form-sm gap-1 hover:bg-surface4 text-neutral3 hover:text-neutral6">
            Cancel
          </button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <button className="bg-surface2 border border-border1 px-2 text-ui-md inline-flex items-center justify-center rounded-md border h-form-sm gap-1 hover:bg-surface4 text-neutral3 hover:text-neutral6">
            Send
          </button>
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
