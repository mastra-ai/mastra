import { MessageSquare, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { ConversationComposer } from './composer';
import type { ModelControlState } from './controls/models';
import type { ChatPresentation, Scenario } from './data';
import { ConversationContext } from './presentation/events';
import { ConversationResponse } from './presentation/response';
import { useStoryConversation } from './use-conversation';
import { UserFilePartRenderer } from '@/domains/chat/messages/renderers/user-file-part-renderer';
import { UserTextPartRenderer } from '@/domains/chat/messages/renderers/user-text-part-renderer';
import type { TaskListItem } from '@/ds/components/ai/task-list';
import { TaskList } from '@/ds/components/ai/task-list';
import { Button } from '@/ds/components/Button';
import { ChatShell } from '@/ds/components/ChatShell';
import type { ComposerTone } from '@/ds/components/Composer';
import { EmptyState } from '@/ds/components/EmptyState';
import { Message, MessageActions, MessageCopyButton, MessageTimestamp } from '@/ds/components/Message';
import { MessageScrollerItem } from '@/ds/components/MessageScroller';
import { ThreadRail } from '@/ds/components/ThreadRail';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';

interface ChatConversationProps {
  scenario: Scenario;
  presentation?: ChatPresentation;
  tone?: ComposerTone;
  factorySession?: 'work-item' | 'personal';
  modelState?: ModelControlState;
  canSendWhileStreaming?: boolean;
}

function Conversation({
  scenario,
  presentation = 'studio',
  tone = 'green',
  factorySession = 'work-item',
  modelState = 'ready',
  canSendWhileStreaming = false,
  onReset,
}: ChatConversationProps & { onReset: () => void }) {
  const canInterject = presentation === 'factory' || canSendWhileStreaming;
  const { turns, phase, busy, sendMessage, transitionTurn } = useStoryConversation(
    scenario,
    presentation,
    canInterject,
  );
  const activeTurn = turns.at(-1);
  let verificationStatus: TaskListItem['status'] = 'pending';
  if (phase === 'complete') verificationStatus = 'completed';
  if (phase === 'streaming') verificationStatus = 'in_progress';
  return (
    <TooltipProvider>
      <ChatShell className="h-dvh" scroller={{ autoScroll: true, defaultScrollPosition: 'end' }}>
        <ChatShell.Bar>
          <ChatShell.Column className="flex-row items-center justify-between gap-3 py-3">
            <Txt as="h1" variant="header-xs">
              {presentation === 'factory' ? 'Factory' : 'Studio'} · Composer review
            </Txt>
            <Button size="sm" variant="ghost" onClick={onReset}>
              <RotateCcw />
              Reset conversation
            </Button>
          </ChatShell.Column>
        </ChatShell.Bar>
        <ChatShell.Stage>
          <ChatShell.Viewport>
            <ChatShell.Content>
              <ChatShell.Column className="gap-8 py-6">
                {turns.length === 0 && (
                  <EmptyState
                    iconSlot={<MessageSquare />}
                    titleSlot="Start a conversation"
                    descriptionSlot="Add a file or send a message to try the composer."
                  />
                )}
                {turns.map((turn, index) => (
                  <ChatShell.Turn
                    key={turn.id}
                    role="region"
                    aria-label={`Turn ${index + 1}`}
                    opensTurn
                    holdsRoom={turn.phase === 'streaming'}
                    restored={turn.id === 'review'}
                    className="gap-6"
                  >
                    <MessageScrollerItem messageId={turn.id} scrollAnchor>
                      <Message
                        from="user"
                        footer={
                          <MessageActions>
                            {turn.prompt && <MessageCopyButton text={turn.prompt} />}
                            {presentation === 'factory' && <MessageTimestamp value="2026-09-17T12:00:00Z" />}
                          </MessageActions>
                        }
                      >
                        {turn.prompt && <UserTextPartRenderer part={{ type: 'text', text: turn.prompt }} />}
                        <div className="flex max-w-full flex-wrap justify-end gap-2">
                          {turn.files.map((file, fileIndex) => (
                            <UserFilePartRenderer key={`${file.filename}-${fileIndex}`} part={file} />
                          ))}
                        </div>
                      </Message>
                    </MessageScrollerItem>
                    <MessageScrollerItem messageId={`${turn.id}-reply`} className="flex min-w-0 flex-col gap-3">
                      {turn.review && <ConversationContext presentation={presentation} />}
                      <ConversationResponse turn={turn} presentation={presentation} transitionTurn={transitionTurn} />
                    </MessageScrollerItem>
                  </ChatShell.Turn>
                ))}
              </ChatShell.Column>
            </ChatShell.Content>
            <ChatShell.Dock>
              <ChatShell.ScrollButton aria-label="Jump to latest message" />
              <ChatShell.Column className="gap-2">
                {activeTurn?.review && (
                  <TaskList
                    defaultOpen={false}
                    hideWhenComplete={false}
                    scrollActiveIntoView={false}
                    tasks={[
                      {
                        id: 'inspect',
                        content: 'Inspect the composer',
                        activeForm: 'Inspecting the composer',
                        status: 'completed',
                      },
                      { id: 'plan', content: 'Review the plan', activeForm: 'Reviewing the plan', status: 'completed' },
                      {
                        id: 'verify',
                        content: 'Verify the interaction',
                        activeForm: 'Verifying the interaction',
                        status: verificationStatus,
                      },
                    ]}
                  />
                )}
                <ConversationComposer
                  phase={phase}
                  tone={tone}
                  presentation={presentation}
                  factorySession={factorySession}
                  modelState={modelState}
                  canSendWhileStreaming={canInterject}
                  busy={busy}
                  onSend={sendMessage}
                  onStop={() => {
                    if (activeTurn) transitionTurn(activeTurn.id, 'streaming', 'stopped');
                  }}
                />
              </ChatShell.Column>
            </ChatShell.Dock>
          </ChatShell.Viewport>
          <ThreadRail
            turns={turns.map(turn => ({
              key: turn.id,
              messageId: turn.id,
              prompt: turn.prompt || 'Attachments',
              reply: turn.text,
              files: turn.files.map(file => file.filename),
              hiddenFileCount: 0,
            }))}
          />
        </ChatShell.Stage>
      </ChatShell>
    </TooltipProvider>
  );
}

export function ChatConversation({
  scenario,
  presentation,
  tone,
  factorySession,
  modelState,
  canSendWhileStreaming,
}: ChatConversationProps) {
  const [revision, setRevision] = useState(0);
  return (
    <Conversation
      key={`${scenario}-${presentation}-${factorySession}-${modelState}-${revision}`}
      scenario={scenario}
      presentation={presentation}
      tone={tone}
      factorySession={factorySession}
      modelState={modelState}
      canSendWhileStreaming={canSendWhileStreaming}
      onReset={() => setRevision(current => current + 1)}
    />
  );
}
