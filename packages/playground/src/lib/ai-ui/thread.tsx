import type { MessagePrimitive } from '@assistant-ui/react';
import { ComposerPrimitive, ThreadPrimitive, useComposerRuntime, useThreadRuntime } from '@assistant-ui/react';
import { Avatar, Button, cn, useAutoscroll } from '@mastra/playground-ui';
import { ArrowUp, Mic, PlusIcon, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AttachFileDialog } from './attachments/attach-file-dialog';
import { ComposerAttachments } from './attachments/attachment';
import { BracketOverlay } from './components/bracket-overlay';
import { AssistantMessage } from './messages/assistant-message';
import { SaveFullConversationAction } from './messages/dataset-save-action';
import { UserMessage } from './messages/user-messages';
import { BrowserThumbnail, useBrowserSession } from '@/domains/agents';
import { ComposerModelSwitcher } from '@/domains/agents/components/composer-model-switcher';
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
  composerControls?: React.ReactNode;
}

export const Thread = ({
  agentName,
  agentId,
  threadId,
  hasMemory,
  hasModelList,
  hideModelSwitcher,
  composerControls,
}: ThreadProps) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  useAutoscroll(areaRef, { enabled: true });
  const { hasSession, viewMode, isInSidebar } = useBrowserSession();

  // Show thumbnail in chat when:
  // 1. There's an active session
  // 2. View mode is collapsed or expanded (not modal)
  // 3. NOT currently viewing browser in sidebar
  const showThumbnailInChat = hasSession && (viewMode === 'collapsed' || viewMode === 'expanded') && !isInSidebar;

  const threadRuntime = useThreadRuntime();
  const isEmpty = useSyncExternalStore(
    cb => threadRuntime.subscribe(cb),
    () => threadRuntime.getState().messages.length === 0,
  );

  const WrappedAssistantMessage = (props: MessagePrimitive.Root.Props) => {
    return <AssistantMessage {...props} hasModelList={hasModelList} />;
  };

  const composer = (
    <Composer
      agentId={agentId}
      hasModelList={hasModelList}
      hideModelSwitcher={hideModelSwitcher}
      controls={composerControls}
    />
  );

  const memoryWarning = !hasMemory && (
    <div className="flex items-center justify-center gap-2 max-w-3xl mx-auto px-4 py-2 mt-1 text-warning1">
      <TriangleAlert className="h-4 w-4 shrink-0" />
      <p className="text-xs">
        Memory not enabled — thread messages will not be stored.{' '}
        <a
          href="https://mastra.ai/docs/memory/overview"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80"
        >
          Learn how to activate memory
        </a>
      </p>
    </div>
  );

  return (
    <ThreadWrapper isEmpty={isEmpty}>
      <ThreadPrimitive.Viewport ref={areaRef} autoScroll={false} className="overflow-y-scroll scroll-smooth h-full">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center pb-16">
            <Avatar name={agentName || 'Agent'} size="lg" />
            <p className="mt-4 mb-6 font-medium">How can I help you today?</p>
            <div className="w-full max-w-3xl px-4">
              {composer}
              {memoryWarning}
            </div>
          </div>
        ) : (
          <>
            <div ref={messagesContainerRef} className="relative max-w-3xl w-full mx-auto px-4 pb-7">
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
          </>
        )}
      </ThreadPrimitive.Viewport>

      {!isEmpty && (
        <div className="pb-4">
          {/* Browser thumbnail - shown above composer when in collapsed/expanded mode */}
          {showThumbnailInChat && agentId && threadId && (
            <div className="mx-4 mb-2 max-w-3xl w-full mx-auto">
              <BrowserThumbnail agentName={agentName} />
            </div>
          )}
          {composer}
          {memoryWarning}
        </div>
      )}

    </ThreadWrapper>
  );
};

const ThreadWrapper = ({ children, isEmpty }: { children: React.ReactNode; isEmpty: boolean }) => {
  return (
    <ThreadPrimitive.Root
      className={cn(
        'grid h-full overflow-y-auto transition-[grid-template-rows] duration-slow ease-out-custom',
        isEmpty ? 'grid-rows-[1fr]' : 'grid-rows-[1fr_auto]',
      )}
      data-testid="thread-wrapper"
    >
      {children}
    </ThreadPrimitive.Root>
  );
};



interface ComposerProps {
  threadId?: string;
  agentId?: string;
  hasModelList?: boolean;
  hideModelSwitcher?: boolean;
  controls?: React.ReactNode;
}

const Composer = ({ agentId, hasModelList, hideModelSwitcher, controls }: ComposerProps) => {
  const { setThreadInput } = useThreadInput();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRuntime = useComposerRuntime();
  const threadRuntime = useThreadRuntime();
  const isComposingRef = useRef(false);
  const { canExecute } = usePermissions();
  const canExecuteAgent = canExecute('agents');

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (isComposingRef.current || e.nativeEvent.isComposing)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key !== 'ArrowUp') return;
      if (composerRuntime.getState().text.trim() !== '') return;

      const messages = threadRuntime.getState().messages;
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== 'user') continue;
        const textPart = msg.content.find(p => p.type === 'text');
        if (textPart && 'text' in textPart) {
          composerRuntime.setText(textPart.text);
          e.preventDefault();
        }
        return;
      }
    },
    [composerRuntime, threadRuntime],
  );

  return (
    <div className="mx-4">
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
        <div className="max-w-3xl w-full mx-auto pb-2">
          <ComposerAttachments />
        </div>

        <div className="bg-surface3 rounded-lg border border-border1 py-4 mt-auto max-w-3xl w-full mx-auto px-4 focus-within:outline-solid focus-within:outline-accent1 -outline-offset-2">
          <ComposerPrimitive.Input asChild className="w-full">
            <textarea
              ref={textareaRef}
              autoFocus={false}
              className="text-ui-lg leading-ui-lg placeholder:text-neutral3 text-neutral6 bg-transparent focus:outline-hidden resize-none outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
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
              onKeyDown={handleKeyDown}
              disabled={!canExecuteAgent}
            />
          </ComposerPrimitive.Input>
          <div className="flex items-center justify-between gap-2">
            {agentId && !hasModelList && !hideModelSwitcher && <ComposerModelSwitcher agentId={agentId} />}
            <div className="flex items-center gap-2 ml-auto">
              {controls}
              {canExecuteAgent && <SpeechInput agentId={agentId} />}
              <ComposerAction canExecute={canExecuteAgent} />
            </div>
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
    <Button
      variant="default"
      size="icon-md"
      type="button"
      tooltip={isListening ? 'Stop dictation' : 'Start dictation'}
      className="rounded-full"
      onClick={() => (isListening ? stop() : start())}
    >
      {isListening ? <CircleStopIcon /> : <Mic className="h-6 w-6 text-neutral3 hover:text-neutral6" />}
    </Button>
  );
};

interface ComposerActionProps {
  canExecute?: boolean;
}

const ComposerAction = ({ canExecute = true }: ComposerActionProps) => {
  const [isAddAttachmentDialogOpen, setIsAddAttachmentDialogOpen] = useState(false);

  return (
    <>
      {canExecute && (
        <Button
          variant="default"
          size="icon-md"
          type="button"
          tooltip="Add attachment"
          className="rounded-full"
          onClick={() => setIsAddAttachmentDialogOpen(true)}
        >
          <PlusIcon className="h-6 w-6 text-neutral3 hover:text-neutral6" />
        </Button>
      )}

      <AttachFileDialog open={isAddAttachmentDialogOpen} onOpenChange={setIsAddAttachmentDialogOpen} />

      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild disabled={!canExecute}>
          <Button
            variant="default"
            size="icon-md"
            tooltip={canExecute ? 'Send' : 'No permission to execute'}
            className="rounded-full border border-border1 bg-surface5"
            disabled={!canExecute}
          >
            <ArrowUp className="h-6 w-6 text-neutral3 hover:text-neutral6" />
          </Button>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>
      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Button variant="default" size="icon-md" tooltip="Cancel">
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
