import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import {
  Composer,
  ComposerActions,
  ComposerAttachments,
  ComposerBox,
  ComposerInput,
} from '@mastra/playground-ui/components/Composer';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@mastra/playground-ui/components/MessageScroller';
import { PendingIndicator } from '@mastra/playground-ui/components/PendingIndicator';
import { buildThreadRailTurns, getClientMessageKey, ThreadRail } from '@mastra/playground-ui/components/ThreadRail';
import type { ThreadRailTurn } from '@mastra/playground-ui/components/ThreadRail';
import { useAutoscroll } from '@mastra/playground-ui/hooks/use-autoscroll';
import type { MessageFactoryPart } from '@mastra/react';
import { useSpeechRecognition } from '@mastra/react';
import { ArrowUp, Mic } from 'lucide-react';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';

import { AttachFilePopover } from './attachments/attach-file-popover';
import { ComposerAttachments as ChatComposerAttachments } from './attachments/attachment';
import { ComposerAttachmentsProvider, useComposerAttachments } from './attachments/composer-attachments';
import { useChatMessages, useChatRunning, useChatSend } from './chat/chat-context';
import { useReadAloud } from './chat/use-read-aloud';
import { BracketOverlay } from './components/bracket-overlay';
import './thread.css';
import { SaveFullConversationAction } from './messages/dataset-save-action';
import { MessageRow } from './messages/message-row';
import { TaskPanel } from './task-panel';
import { BrowserThumbnail, useBrowserSession } from '@/domains/agents';
import { ComposerModelSettings } from '@/domains/agents/components/composer-model-settings';
import { ComposerModelSwitcher, ComposerModelWarning } from '@/domains/agents/components/composer-model-switcher';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useThreadInput } from '@/domains/conversation';
import { useVoiceCall, VoiceCallButton, VoiceCallPanel } from '@/domains/voice';
import type { VoiceCallControls } from '@/domains/voice';
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

const ThreadRailLayer = ({ turns }: { turns: ThreadRailTurn[] }) => {
  if (turns.length === 0) return null;

  return (
    <div
      data-testid="thread-rail-layer"
      className="thread-rail-layer pointer-events-none absolute inset-y-0 left-4 z-20"
    >
      <ThreadRail turns={turns} className="pointer-events-auto sticky top-1/2 -translate-y-1/2" />
    </div>
  );
};

export interface ThreadProps {
  agentName?: string;
  agentId?: string;
  threadId?: string;
  hasModelList?: boolean;
  hideModelSwitcher?: boolean;
  /** Extra run-scoped controls (request context, tracing options) rendered in the composer action row */
  runOptionsSlot?: React.ReactNode;
  /**
   * Called when a voice call connects. On a brand-new chat the agent page passes its
   * thread-list refresh here so the page navigates from /new to the real thread URL.
   */
  refreshThreadList?: () => Promise<void> | void;
}

export const Thread = ({
  agentName,
  agentId,
  threadId,
  hasModelList,
  hideModelSwitcher,
  runOptionsSlot,
  refreshThreadList,
}: ThreadProps) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  useAutoscroll(areaRef, { enabled: true });

  const messages = useChatMessages();
  const { isRunning } = useChatRunning();
  const { requestContext } = usePlaygroundStore();
  const { isSpeaking, readAloud, stop: stopSpeaking } = useReadAloud(agentId, requestContext);

  const { hasSession, viewMode } = useBrowserSession();
  const showThumbnailInChat = hasSession && (viewMode === 'collapsed' || viewMode === 'expanded');

  const isEmpty = messages.length === 0;
  const lastMessage = messages[messages.length - 1];
  const showPending = isRunning && (lastMessage?.role !== 'assistant' || !hasStreamingPart(lastMessage));
  const delayedPending = useDelayedFlag(showPending, SKELETON_DELAY_MS);
  const threadRailTurns = useMemo(() => buildThreadRailTurns(messages), [messages]);
  const threadRailAnchorIds = useMemo(() => new Set(threadRailTurns.map(turn => turn.messageId)), [threadRailTurns]);

  return (
    <ComposerAttachmentsProvider>
      <MessageScrollerProvider>
        <div className="group/thread grid h-full grid-rows-[1fr_auto] overflow-y-auto" data-testid="thread-wrapper">
          <MessageScroller>
            <MessageScrollerViewport
              ref={areaRef}
              className="h-full overflow-y-scroll"
              style={{ overflowAnchor: 'none' }}
            >
              {isEmpty ? (
                <ThreadWelcome agentName={agentName} />
              ) : (
                <div data-testid="thread-rail-container" className="thread-rail-container relative min-h-full">
                  <ThreadRailLayer turns={threadRailTurns} />
                  <div
                    ref={messagesContainerRef}
                    data-testid="thread-message-column"
                    className="relative mx-auto w-full max-w-3xl px-4 pb-7 group-has-[[data-attachments-row]]/thread:pb-24"
                  >
                    <BracketOverlay containerRef={messagesContainerRef} />
                    <MessageScrollerContent className="flex flex-col gap-6 py-6">
                      {messages.map(message => {
                        // Prefer the optimistic `clientMessageId` as the React key so the
                        // user row keeps a stable identity when `data-user-message`
                        // reconciliation swaps `message.id` to the server signal id. A
                        // changing key would unmount/remount the row and shift the
                        // trailing pending indicator. Falls back to `message.id` for
                        // messages without a correlation key (assistant, reloaded).
                        const messageKey = getClientMessageKey(message);
                        return (
                          <MessageScrollerItem
                            key={messageKey}
                            messageId={message.id}
                            scrollAnchor={threadRailAnchorIds.has(message.id)}
                          >
                            <MessageRow
                              message={message}
                              hasModelList={hasModelList}
                              isSpeaking={isSpeaking}
                              onReadAloud={readAloud}
                              onStopSpeaking={stopSpeaking}
                            />
                          </MessageScrollerItem>
                        );
                      })}
                      {delayedPending && <PendingIndicator />}
                    </MessageScrollerContent>

                    {!isRunning && <SaveFullConversationAction />}
                  </div>
                </div>
              )}
            </MessageScrollerViewport>
            <MessageScrollerButton className="z-30" />
          </MessageScroller>

          {showThumbnailInChat && agentId && threadId && (
            <div className="mx-auto mb-2 w-full max-w-3xl px-4">
              <BrowserThumbnail agentName={agentName} />
            </div>
          )}

          <TaskPanel />

          <AgentComposer
            agentId={agentId}
            threadId={threadId}
            hasModelList={hasModelList}
            hideModelSwitcher={hideModelSwitcher}
            runOptionsSlot={runOptionsSlot}
            refreshThreadList={refreshThreadList}
          />
        </div>
      </MessageScrollerProvider>
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

interface AgentComposerProps {
  agentId?: string;
  threadId?: string;
  hasModelList?: boolean;
  hideModelSwitcher?: boolean;
  runOptionsSlot?: React.ReactNode;
  refreshThreadList?: () => Promise<void> | void;
}

const AgentComposer = ({
  agentId,
  threadId,
  hasModelList,
  hideModelSwitcher,
  runOptionsSlot,
  refreshThreadList,
}: AgentComposerProps) => {
  const { threadInput: text, setThreadInput } = useThreadInput(threadId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const send = useChatSend();
  const { attachments, toCoreUserMessages, clear } = useComposerAttachments();
  const { isRunning, canSendWhileStreaming, cancelRun } = useChatRunning();
  const [sendPulseKey, setSendPulseKey] = useState(0);
  const { canExecute } = usePermissions();
  const canExecuteAgent = canExecute('agents');
  // On a brand-new chat, starting the call must transition the page out of its
  // new-thread state (same as the first text send) or the chat never loads messages.
  const voiceCall = useVoiceCall({ agentId, threadId, onCallStarted: refreshThreadList });

  const isEmpty = text.trim().length === 0 && attachments.length === 0;
  const sendBlocked = isRunning && !canSendWhileStreaming;

  const submit = async () => {
    if (isEmpty || sendBlocked || !canExecuteAgent) return;
    const coreUserMessages = attachments.length > 0 ? await toCoreUserMessages() : undefined;
    const message = text;
    setThreadInput('');
    clear();
    setSendPulseKey(k => k + 1);
    send({ message, attachments: coreUserMessages });
  };

  return (
    // Named so the chat/settings view transition can slide the composer toward
    // the bottom edge independently of the root crossfade.
    <div className="relative" style={{ viewTransitionName: 'agent-chat-composer' }}>
      <VoiceCallPanel voiceCall={voiceCall} />
      <Composer
        className="relative px-2 pb-2"
        onSubmit={event => {
          event.preventDefault();
          void submit();
        }}
      >
        <ComposerAttachments>
          <ChatComposerAttachments />
        </ComposerAttachments>
        <ComposerBox sendingPulseKey={sendPulseKey}>
          <ComposerInput
            ref={textareaRef}
            value={text}
            autoFocus={false}
            placeholder={canExecuteAgent ? 'Enter your message...' : "You don't have permission to execute agents"}
            onChange={event => {
              setThreadInput(event.target.value);
            }}
            onKeyDown={event => {
              // Ignore Enter while an IME composition is active (e.g. committing a
              // CJK/pinyin candidate). `isComposing` is the browser-owned flag; the
              // `keyCode === 229` fallback covers browsers that fire keydown without it.
              if (event.nativeEvent.isComposing || event.keyCode === 229) return;
              if (event.key === 'Enter' && !event.shiftKey) {
                if (sendBlocked) return;
                event.preventDefault();
                event.stopPropagation();
                void submit();
              }
            }}
            disabled={!canExecuteAgent}
          />
          {agentId && !hasModelList && !hideModelSwitcher && <ComposerModelWarning />}
          <ComposerActions>
            <ComposerActionRow
              canExecute={canExecuteAgent}
              agentId={agentId}
              runOptionsSlot={runOptionsSlot}
              showModelSwitcher={Boolean(agentId && !hasModelList && !hideModelSwitcher)}
              isEmpty={isEmpty}
              isRunning={isRunning}
              canSendWhileStreaming={canSendWhileStreaming}
              onCancel={() => void cancelRun()}
              onSetText={value => {
                setThreadInput(value);
              }}
              voiceCall={voiceCall}
            />
          </ComposerActions>
        </ComposerBox>
      </Composer>
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
      {isListening ? <CircleStopIcon /> : <Mic className="text-neutral3 hover:text-neutral6 h-5 w-5" />}
    </Button>
  );
};

interface ComposerActionRowProps {
  canExecute?: boolean;
  agentId?: string;
  showModelSwitcher?: boolean;
  runOptionsSlot?: React.ReactNode;
  isEmpty: boolean;
  isRunning: boolean;
  canSendWhileStreaming: boolean;
  onCancel: () => void;
  onSetText: (text: string) => void;
  voiceCall?: VoiceCallControls;
}

const ComposerActionRow = ({
  canExecute = true,
  agentId,
  showModelSwitcher,
  runOptionsSlot,
  isEmpty,
  isRunning,
  canSendWhileStreaming,
  onCancel,
  onSetText,
  voiceCall,
}: ComposerActionRowProps) => {
  return (
    <>
      {((showModelSwitcher && agentId) || runOptionsSlot) && (
        <div className="flex max-w-full shrink-0 items-center gap-1.5">
          {showModelSwitcher && agentId && (
            <>
              <div className="bg-surface3 border-border1 duration-normal focus-within:border-border2 rounded-full border transition-colors">
                <ComposerModelSwitcher />
              </div>
              <ComposerModelSettings agentId={agentId} />
            </>
          )}
          {runOptionsSlot}
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1.5">
        <ButtonsGroup spacing="close">
          {canExecute && <AttachFilePopover />}
          {canExecute && <SpeechInput agentId={agentId} onTranscript={onSetText} />}
          {canExecute && agentId && voiceCall && <VoiceCallButton voiceCall={voiceCall} />}
        </ButtonsGroup>
        <ComposerSendButton
          canExecute={canExecute}
          isEmpty={isEmpty}
          isRunning={isRunning}
          canSendWhileStreaming={canSendWhileStreaming}
          onCancel={onCancel}
        />
      </div>
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
        className="border-border1 bg-surface5 rounded-full border"
        disabled={!canExecute || isEmpty}
      >
        <ArrowUp className="text-neutral3 hover:text-neutral6 h-6 w-6" />
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
