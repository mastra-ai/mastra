import type { MessagePrimitive } from '@assistant-ui/react';
import { ComposerPrimitive, ThreadPrimitive, useComposerRuntime } from '@assistant-ui/react';
import { Avatar, Button, ButtonsGroup, useAutoscroll } from '@mastra/playground-ui';
import { ArrowUp, Mic, PlusIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AttachFileDialog } from './attachments/attach-file-dialog';
import { ComposerAttachments } from './attachments/attachment';
import { BracketOverlay } from './components/bracket-overlay';
import { AssistantMessage } from './messages/assistant-message';
import { SaveFullConversationAction } from './messages/dataset-save-action';
import { UserMessage } from './messages/user-messages';
import { BrowserThumbnail, useBrowserSession } from '@/domains/agents';
import { ComposerModelSwitcher, ComposerModelWarning } from '@/domains/agents/components/composer-model-switcher';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useThreadInput } from '@/domains/conversation';
import { useSpeechRecognition } from '@/domains/voice/hooks/use-speech-recognition';
// import { useBackgroundTaskStream } from '@/hooks';

export interface ThreadProps {
  agentName?: string;
  agentId?: string;
  threadId?: string;
  hasMemory?: boolean;
  hasModelList?: boolean;
  hideModelSwitcher?: boolean;
}

export const Thread = ({ agentName, agentId, threadId, hasMemory, hasModelList, hideModelSwitcher }: ThreadProps) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  useAutoscroll(areaRef, { enabled: true });
  const { hasSession, viewMode, isInSidebar } = useBrowserSession();

  // Show thumbnail in chat when:
  // 1. There's an active session
  // 2. View mode is collapsed or expanded (not modal)
  // 3. NOT currently viewing browser in sidebar
  const showThumbnailInChat = hasSession && (viewMode === 'collapsed' || viewMode === 'expanded') && !isInSidebar;

  const WrappedAssistantMessage = (props: MessagePrimitive.Root.Props) => {
    return <AssistantMessage {...props} hasModelList={hasModelList} />;
  };

  return (
    <ThreadWrapper>
      <ThreadPrimitive.Viewport ref={areaRef} autoScroll={false} className="overflow-y-scroll scroll-smooth h-full">
        <ThreadWelcome agentName={agentName} />

        <div
          ref={messagesContainerRef}
          className="relative max-w-3xl w-full mx-auto px-4 pb-7 group-has-[[data-attachments-row]]/thread:pb-24"
        >
          <BracketOverlay containerRef={messagesContainerRef} />
          <ThreadPrimitive.Messages
            components={{
              UserMessage: UserMessage,
              EditComposer: EditComposer,
              AssistantMessage: WrappedAssistantMessage,
            }}
          />
        </div>

        <ThreadPrimitive.If empty={false}>
          <ThreadPrimitive.If running={false}>
            <SaveFullConversationAction />
          </ThreadPrimitive.If>
          <div />
        </ThreadPrimitive.If>
      </ThreadPrimitive.Viewport>

      {/* Browser thumbnail - shown above composer when in collapsed/expanded mode */}
      {showThumbnailInChat && agentId && threadId && (
        <div className="mb-2 max-w-3xl w-full mx-auto px-4">
          <BrowserThumbnail agentName={agentName} />
        </div>
      )}

      <Composer
        hasMemory={hasMemory}
        threadId={threadId}
        agentId={agentId}
        hasModelList={hasModelList}
        hideModelSwitcher={hideModelSwitcher}
      />
    </ThreadWrapper>
  );
};

const ThreadWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThreadPrimitive.Root
      className="group/thread grid grid-rows-[1fr_auto] h-full overflow-y-auto"
      data-testid="thread-wrapper"
    >
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
      <div className="flex w-full grow flex-col items-center pt-[15vh]">
        <Avatar name={agentName || 'Agent'} size="lg" />
        <p className="mt-4 font-medium">How can I help you today?</p>
      </div>
    </ThreadPrimitive.Empty>
  );
};

interface ComposerProps {
  hasMemory?: boolean;
  threadId?: string;
  agentId?: string;
  hasModelList?: boolean;
  hideModelSwitcher?: boolean;
}

const Composer = ({ agentId, hasModelList, hideModelSwitcher }: ComposerProps) => {
  const { setThreadInput } = useThreadInput();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Track IME composition state to prevent Enter from submitting during CJK input.
  // Without this, pressing Enter to confirm a Chinese/Japanese/Korean character
  // triggers form submission instead of completing the IME composition.
  // See: https://github.com/mastra-ai/mastra/issues/16109
  const isComposingRef = useRef(false);
  const { canExecute } = usePermissions();
  const canExecuteAgent = canExecute('agents');

  // const { runningTasks, completedTasks, failedTasks, clearCompletedAndFailedTasks } = useBackgroundTaskStream({
  //   threadId,
  //   agentId,
  // });

  return (
    <div className="relative px-2 pb-2">
      {/* <div className="flex gap-2 items-center">
        {runningTasks.length > 0 ? (
          <div className="pt-2">
            <Badge variant="info" icon={<Loader2Icon className="animate-spin" />}>
              {runningTasks.length} background task{runningTasks.length > 1 ? 's' : ''}{' '}
              {runningTasks.length > 1 ? 'are' : 'is'} running
            </Badge>
          </div>
        ) : null}
        {completedTasks.length > 0 ? (
          <div className="pt-2">
            <Badge variant="success" icon={<CheckCircleIcon />}>
              {completedTasks.length} background task{completedTasks.length > 1 ? 's' : ''} completed
            </Badge>
          </div>
        ) : null}
        {failedTasks.length > 0 ? (
          <div className="pt-2">
            <Badge variant="error" icon={<XCircleIcon />}>
              {failedTasks.length} background task{failedTasks.length > 1 ? 's' : ''} failed
            </Badge>
          </div>
        ) : null}
      </div> */}
      {/* <ComposerPrimitive.Root onSubmit={clearCompletedAndFailedTasks}> */}
      <ComposerPrimitive.Root>
        <ComposerAttachments />

        <div
          className="bg-surface3 rounded-[22px] border border-border1 mt-auto max-w-3xl w-full mx-auto transition-colors duration-normal focus-within:border-border2 @container"
          onClick={e => {
            if (e.target === e.currentTarget) textareaRef.current?.focus();
          }}
        >
          <ComposerPrimitive.Input asChild className="w-full">
            <textarea
              ref={textareaRef}
              autoFocus={false}
              className="text-ui-lg leading-ui-lg placeholder:text-neutral3 text-neutral6 bg-transparent focus:outline-hidden resize-none outline-hidden disabled:cursor-not-allowed disabled:opacity-50 px-3 pt-3 pb-2"
              placeholder={canExecuteAgent ? 'Enter your message...' : "You don't have permission to execute agents"}
              name=""
              id=""
              onChange={e => setThreadInput?.(e.target.value)}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={() => {
                isComposingRef.current = false;
              }}
              onKeyDown={e => {
                // Block Enter from reaching ComposerPrimitive.Input's composed submit handler
                // while an IME composition session is active (e.g. Chinese pinyin).
                // With asChild composition (@radix-ui/react-slot), stopPropagation() alone does
                // not prevent the primitive's onKeyDown from running on the same element —
                // preventDefault() is required. e.nativeEvent.isComposing is added as a
                // defensive fallback for browsers/timings where compositionend has already fired.
                if (e.key === 'Enter' && (isComposingRef.current || e.nativeEvent.isComposing)) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              disabled={!canExecuteAgent}
            />
          </ComposerPrimitive.Input>
          {agentId && !hasModelList && !hideModelSwitcher && <ComposerModelWarning agentId={agentId} />}
          <ComposerActionRow
            canExecute={canExecuteAgent}
            agentId={agentId}
            showModelSwitcher={Boolean(agentId && !hasModelList && !hideModelSwitcher)}
          />
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
    <Button
      variant="default"
      size="icon-md"
      type="button"
      tooltip={isListening ? 'Stop dictation' : 'Start dictation'}
      onClick={() => (isListening ? stop() : start())}
    >
      {isListening ? <CircleStopIcon /> : <Mic className="h-5 w-5 text-neutral3 hover:text-neutral6" />}
    </Button>
  );
};

interface ComposerActionProps {
  canExecute?: boolean;
}

interface ComposerActionRowProps extends ComposerActionProps {
  agentId?: string;
  showModelSwitcher?: boolean;
}

const ComposerActionRow = ({ canExecute = true, agentId, showModelSwitcher }: ComposerActionRowProps) => {
  const [isAddAttachmentDialogOpen, setIsAddAttachmentDialogOpen] = useState(false);

  return (
    <>
      {/* Keep action buttons above the switcher when this row wraps. */}
      <div className="flex flex-wrap-reverse items-center gap-2 px-1.5 pb-1.5">
        {showModelSwitcher && agentId && (
          <div className="shrink-0 max-w-full rounded-full bg-surface3 border border-border1 transition-colors duration-normal focus-within:border-border2">
            <ComposerModelSwitcher agentId={agentId} />
          </div>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <ButtonsGroup spacing="close">
            {canExecute && (
              <Button
                variant="default"
                size="icon-md"
                type="button"
                tooltip="Add attachment"
                onClick={() => setIsAddAttachmentDialogOpen(true)}
              >
                <PlusIcon className="h-5 w-5 text-neutral3 hover:text-neutral6" />
              </Button>
            )}
            {canExecute && <SpeechInput agentId={agentId} />}
          </ButtonsGroup>
          <ComposerSendButton canExecute={canExecute} />
        </div>
      </div>
      <AttachFileDialog open={isAddAttachmentDialogOpen} onOpenChange={setIsAddAttachmentDialogOpen} />
    </>
  );
};

const ComposerSendButton = ({ canExecute = true }: ComposerActionProps) => {
  return (
    <>
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild disabled={!canExecute}>
          <Button
            variant="default"
            size="icon-md"
            tooltip={canExecute ? 'Send' : 'No permission to execute'}
            className="rounded-full border border-border1 bg-surface5"
            disabled={!canExecute}
          >
            <ArrowUp className="h-5 w-5 text-neutral3 hover:text-neutral6" />
          </Button>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Button variant="default" size="icon-md" className="rounded-full" tooltip="Cancel">
            <CircleStopIcon />
          </Button>
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
          <button className="bg-surface2 border border-border1 px-2 text-ui-md inline-flex items-center justify-center rounded-md h-form-sm gap-1 hover:bg-surface4 text-neutral3 hover:text-neutral6">
            Cancel
          </button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <button className="bg-surface2 border border-border1 px-2 text-ui-md inline-flex items-center justify-center rounded-md h-form-sm gap-1 hover:bg-surface4 text-neutral3 hover:text-neutral6">
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
