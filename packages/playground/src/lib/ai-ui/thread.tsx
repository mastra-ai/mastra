import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { Avatar, Button, ButtonsGroup, cn, PendingIndicator, useAutoscroll } from '@mastra/playground-ui';
import type { MessageFactoryPart } from '@mastra/react';
import { useSpeechRecognition } from '@mastra/react';
import { ArrowUp, EyeIcon, Mic, PlusIcon } from 'lucide-react';
import { startTransition, useEffect, useRef, useState } from 'react';

import { AttachFileDialog } from './attachments/attach-file-dialog';
import { ComposerAttachments } from './attachments/attachment';
import { ComposerAttachmentsProvider, useComposerAttachments } from './attachments/composer-attachments';
import { useChatMessages, useChatRunning, useChatSend } from './chat/chat-context';
import { useReadAloud } from './chat/use-read-aloud';
import { BracketOverlay } from './components/bracket-overlay';
import './composer-sending.css';
import { SaveFullConversationAction } from './messages/dataset-save-action';
import { MessageRow } from './messages/message-row';
import { BrowserThumbnail, useBrowserSession } from '@/domains/agents';
import { ComposerModelSettings } from '@/domains/agents/components/composer-model-settings';
import { ComposerModelSwitcher, ComposerModelWarning } from '@/domains/agents/components/composer-model-switcher';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useThreadInput } from '@/domains/conversation';
import { Link } from '@/lib/link';
import { usePlaygroundStore } from '@/store/playground-store';

const SKELETON_DELAY_MS = 300;

/**
 * Returns true only after `flag` has stayed true for `delayMs` continuously, so
 * the pending indicator doesn't flash on fast (local) responses.
 */
const useDelayedFlag = (flag: boolean, delayMs: number) => {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (!flag) {
      setDelayed(false);
      return;
    }
    const id = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(id);
  }, [flag, delayMs]);
  return delayed;
};

/**
 * Detects whether the last assistant message has a part that is actively
 * streaming output. Completed tool calls are excluded so the pending indicator
 * stays visible during quiet moments (e.g. server-side retries).
 */
const hasStreamingPart = (message: MastraDBMessage | undefined) => {
  if (!message) return false;
  const parts: MessageFactoryPart[] = message.content.parts;
  return parts.some(part => {
    if (part.type === 'reasoning' || part.type === 'text') {
      return 'state' in part && part.state === 'streaming';
    }
    if (part.type === 'tool-invocation') {
      return 'toolInvocation' in part && part.toolInvocation.state !== 'result';
    }
    if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
      const state = 'state' in part ? part.state : undefined;
      return state !== 'output-available' && state !== 'output-error';
    }
    return false;
  });
};

export interface ThreadProps {
  agentName?: string;
  agentId?: string;
  threadId?: string;
  hasMemory?: boolean;
  hasModelList?: boolean;
  hideModelSwitcher?: boolean;
}

export const Thread = ({ agentName, agentId, threadId, hasModelList, hideModelSwitcher }: ThreadProps) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  useAutoscroll(areaRef, { enabled: true });

  const messages = useChatMessages();
  const { isRunning } = useChatRunning();
  const { requestContext } = usePlaygroundStore();
  const { isSpeaking, readAloud, stop: stopSpeaking } = useReadAloud(agentId, requestContext);

  const { hasSession, viewMode, isInSidebar } = useBrowserSession();
  const showThumbnailInChat = hasSession && (viewMode === 'collapsed' || viewMode === 'expanded') && !isInSidebar;

  const isEmpty = messages.length === 0;
  const lastMessage = messages[messages.length - 1];
  const showPending = isRunning && (lastMessage?.role !== 'assistant' || !hasStreamingPart(lastMessage));
  const delayedPending = useDelayedFlag(showPending, SKELETON_DELAY_MS);

  return (
    <ComposerAttachmentsProvider>
      <div className="group/thread grid grid-rows-[1fr_auto] h-full overflow-y-auto" data-testid="thread-wrapper">
        <div ref={areaRef} className="overflow-y-scroll h-full" style={{ overflowAnchor: 'none' }}>
          {isEmpty ? (
            <ThreadWelcome agentName={agentName} />
          ) : (
            <div
              ref={messagesContainerRef}
              className="relative max-w-3xl w-full mx-auto px-4 pb-7 group-has-[[data-attachments-row]]/thread:pb-24"
            >
              <BracketOverlay containerRef={messagesContainerRef} />
              <div className="flex flex-col gap-6 py-6">
                {messages.map(message => (
                  <MessageRow
                    key={message.id}
                    message={message}
                    isSpeaking={isSpeaking}
                    onReadAloud={readAloud}
                    onStopSpeaking={stopSpeaking}
                  />
                ))}
                {delayedPending && <PendingIndicator />}
              </div>

              {!isRunning && <SaveFullConversationAction />}
            </div>
          )}
        </div>

        {showThumbnailInChat && agentId && threadId && (
          <div className="mb-2 max-w-3xl w-full mx-auto px-4">
            <BrowserThumbnail agentName={agentName} />
          </div>
        )}

        <Composer
          threadId={threadId}
          agentId={agentId}
          hasModelList={hasModelList}
          hideModelSwitcher={hideModelSwitcher}
        />
      </div>
    </ComposerAttachmentsProvider>
  );
};

export interface ThreadWelcomeProps {
  agentName?: string;
}

const ThreadWelcome = ({ agentName }: ThreadWelcomeProps) => {
  return (
    <div className="flex w-full grow flex-col items-center pt-[15vh]">
      <Avatar name={agentName || 'Agent'} size="lg" />
      <p className="mt-4 font-medium">How can I help you today?</p>
    </div>
  );
};

interface ComposerProps {
  threadId?: string;
  agentId?: string;
  hasModelList?: boolean;
  hideModelSwitcher?: boolean;
}

const Composer = ({ agentId, threadId, hasModelList, hideModelSwitcher }: ComposerProps) => {
  const { setThreadInput } = useThreadInput();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const send = useChatSend();
  const { attachments, toCoreUserMessages, clear } = useComposerAttachments();
  const { isRunning, canSendWhileStreaming, cancelRun } = useChatRunning();
  const [sendPulseKey, setSendPulseKey] = useState(0);
  const { canExecute } = usePermissions();
  const canExecuteAgent = canExecute('agents');

  const isEmpty = text.trim().length === 0 && attachments.length === 0;
  const sendBlocked = isRunning && !canSendWhileStreaming;

  const submit = async () => {
    if (isEmpty || sendBlocked || !canExecuteAgent) return;
    const coreUserMessages = attachments.length > 0 ? await toCoreUserMessages() : undefined;
    const message = text;
    setText('');
    setThreadInput?.('');
    clear();
    setSendPulseKey(k => k + 1);
    send({ message, attachments: coreUserMessages });
  };

  return (
    <div className="relative px-2 pb-2">
      <form
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="max-w-3xl w-full mx-auto pb-2">
          <ComposerAttachments />
        </div>

        <div
          className="relative overflow-hidden bg-surface3 rounded-[22px] border border-border2/40 mt-auto max-w-3xl w-full mx-auto transition-colors duration-normal focus-within:border-border2 @container"
          onClick={e => {
            if (e.target === e.currentTarget) textareaRef.current?.focus();
          }}
        >
          <ComposerSendingGradient pulseKey={sendPulseKey} />
          <div className="relative z-10">
            <textarea
              ref={textareaRef}
              value={text}
              autoFocus={false}
              className="w-full text-ui-lg leading-ui-lg placeholder:text-neutral3 text-neutral6 bg-transparent focus:outline-hidden resize-none outline-hidden disabled:cursor-not-allowed disabled:opacity-50 px-3 pt-3 pb-2"
              placeholder={canExecuteAgent ? 'Enter your message...' : "You don't have permission to execute agents"}
              onChange={e => {
                setText(e.target.value);
                setThreadInput?.(e.target.value);
              }}
              onKeyDown={e => {
                // Ignore Enter while an IME composition is active (e.g. committing a
                // CJK/pinyin candidate). `isComposing` is the browser-owned flag; the
                // `keyCode === 229` fallback covers browsers that fire keydown without it.
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter' && !e.shiftKey) {
                  if (sendBlocked) return;
                  e.preventDefault();
                  e.stopPropagation();
                  void submit();
                }
              }}
              disabled={!canExecuteAgent}
            />
            {agentId && !hasModelList && !hideModelSwitcher && <ComposerModelWarning agentId={agentId} />}
            <ComposerActionRow
              canExecute={canExecuteAgent}
              agentId={agentId}
              threadId={threadId}
              showModelSwitcher={Boolean(agentId && !hasModelList && !hideModelSwitcher)}
              isEmpty={isEmpty}
              isRunning={isRunning}
              canSendWhileStreaming={canSendWhileStreaming}
              onCancel={() => void cancelRun()}
              onSetText={value => {
                setText(value);
                setThreadInput?.(value);
              }}
              hasMessages={!isEmpty || threadId !== undefined}
            />
          </div>
        </div>
      </form>
    </div>
  );
};

const ComposerGradientColumn = ({ className }: { className?: string }) => (
  <div className={cn('flex h-full w-full flex-col -space-y-3', className)}>
    <div className="w-full flex-1 bg-accent1 blur-xl" />
    <div className="w-full flex-1 bg-accent1Dark blur-xl" />
    <div className="w-full flex-1 bg-accent1 blur-xl" />
    <div className="w-full flex-1 bg-accent1Darker blur-xl" />
  </div>
);

const ComposerSendingGradient = ({ pulseKey }: { pulseKey: number }) => {
  if (pulseKey === 0) return null;
  return (
    <div
      key={pulseKey}
      aria-hidden
      className="composer-sending pointer-events-none absolute -left-[10%] top-0 z-0 flex h-10 w-[120%] transform-gpu"
    >
      <ComposerGradientColumn />
      <ComposerGradientColumn className="-translate-y-2" />
      <ComposerGradientColumn />
    </div>
  );
};

const SpeechInput = ({ agentId, onTranscript }: { agentId?: string; onTranscript: (text: string) => void }) => {
  const { requestContext } = usePlaygroundStore();
  const { start, stop, isListening, transcript } = useSpeechRecognition({ agentId, requestContext });

  useEffect(() => {
    if (!transcript) return;
    startTransition(() => onTranscript(transcript));
  }, [onTranscript, transcript]);

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

interface ComposerActionRowProps {
  canExecute?: boolean;
  agentId?: string;
  threadId?: string;
  showModelSwitcher?: boolean;
  isEmpty: boolean;
  isRunning: boolean;
  canSendWhileStreaming: boolean;
  onCancel: () => void;
  onSetText: (text: string) => void;
  hasMessages: boolean;
}

const ComposerActionRow = ({
  canExecute = true,
  agentId,
  threadId,
  showModelSwitcher,
  isEmpty,
  isRunning,
  canSendWhileStreaming,
  onCancel,
  onSetText,
  hasMessages,
}: ComposerActionRowProps) => {
  const [isAddAttachmentDialogOpen, setIsAddAttachmentDialogOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap-reverse justify-between items-center gap-2 px-1.5 pb-1.5">
        {showModelSwitcher && agentId && (
          <div className="flex items-center gap-1.5 shrink-0 max-w-full">
            <div className="rounded-full bg-surface3 border border-border1 transition-colors duration-normal focus-within:border-border2">
              <ComposerModelSwitcher agentId={agentId} />
            </div>
            <ComposerModelSettings agentId={agentId} />
          </div>
        )}

        {threadId && hasMessages && (
          <Button
            as={Link}
            variant="default"
            tooltip="View thread traces"
            href={`/observability?filterThreadId=${encodeURIComponent(threadId)}`}
          >
            <EyeIcon className="h-5 w-5 text-neutral3 hover:text-neutral6" /> Traces
          </Button>
        )}

        <div className="flex shrink-0 items-center gap-1.5">
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
            {canExecute && <SpeechInput agentId={agentId} onTranscript={onSetText} />}
          </ButtonsGroup>
          <ComposerSendButton
            canExecute={canExecute}
            isEmpty={isEmpty}
            isRunning={isRunning}
            canSendWhileStreaming={canSendWhileStreaming}
            onCancel={onCancel}
          />
        </div>
      </div>
      <AttachFileDialog open={isAddAttachmentDialogOpen} onOpenChange={setIsAddAttachmentDialogOpen} />
    </>
  );
};

interface ComposerSendButtonProps {
  canExecute?: boolean;
  isEmpty: boolean;
  isRunning: boolean;
  canSendWhileStreaming: boolean;
  onCancel: () => void;
}

const ComposerSendButton = ({
  canExecute = true,
  isEmpty,
  isRunning,
  canSendWhileStreaming,
  onCancel,
}: ComposerSendButtonProps) => {
  // While streaming and not allowed to send mid-stream, the only action is cancel.
  if (isRunning && !canSendWhileStreaming) {
    return (
      <Button variant="default" size="icon-md" type="button" tooltip="Cancel" onClick={onCancel}>
        <CircleStopIcon />
      </Button>
    );
  }

  return (
    <>
      <Button
        type="submit"
        variant="default"
        size="icon-md"
        tooltip={canExecute ? 'Send' : 'No permission to execute'}
        className="rounded-full border border-border1 bg-surface5"
        disabled={!canExecute || isEmpty}
      >
        <ArrowUp className="h-6 w-6 text-neutral3 hover:text-neutral6" />
      </Button>
      {isRunning && (
        <Button variant="default" size="icon-md" type="button" tooltip="Cancel" onClick={onCancel}>
          <CircleStopIcon />
        </Button>
      )}
    </>
  );
};

const CircleStopIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-neutral3 hover:text-neutral6"
    >
      <circle cx="12" cy="12" r="10" />
      <rect width="6" height="6" x="9" y="9" rx="1" />
    </svg>
  );
};
