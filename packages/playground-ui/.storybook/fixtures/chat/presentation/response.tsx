import type { TextPart } from '@mastra/react/ui';
import { plan, reviewCommand, reviewTools } from '../data';
import type { ChatPresentation, Phase, Turn } from '../data';
import { ConversationApproval } from './approval';
import { ConversationNotification } from './events';
import { ReviewTool } from './tool';
import { MessageText } from '@/domains/chat/messages/renderers/message-text';
import { ReasoningPartRenderer } from '@/domains/chat/messages/renderers/reasoning-part-renderer';
import { AskUser } from '@/ds/components/ai/ask-user';
import { useRevealedParts } from '@/ds/components/ai/message-reveal';
import {
  Plan,
  PlanBody,
  PlanContent,
  PlanHeader,
  PlanHeaderActions,
  PlanCopyButton,
  PlanIntro,
  PlanLabel,
  PlanMain,
  PlanTitle,
} from '@/ds/components/ai/plan';
import { ToolCallGroup, ToolCallTime } from '@/ds/components/ai/tool-call';
import { Button } from '@/ds/components/Button';
import { Message, MessageActions, MessageCopyButton, MessageTimestamp } from '@/ds/components/Message';

interface ConversationResponseProps {
  turn: Turn;
  presentation: ChatPresentation;
  transitionTurn: (id: string, from: Phase, to: Phase, answer?: string) => void;
}

export function ConversationResponse({ turn, presentation, transitionTurn }: ConversationResponseProps) {
  const writtenParts = [{ type: 'text', text: turn.text }] satisfies TextPart[];
  const shownParts = useRevealedParts(writtenParts, turn.phase === 'streaming');
  const shownPart = shownParts[0];
  const shownText = shownPart?.type === 'text' ? shownPart.text : '';
  const isRevealing = shownParts !== writtenParts;
  const approveEdit = () => transitionTurn(turn.id, 'approval', 'streaming');
  const declineEdit = () => transitionTurn(turn.id, 'approval', 'declined');
  const showSettledCommand = turn.review && (turn.phase === 'complete' || turn.phase === 'stopped');
  return (
    <Message
      from="assistant"
      footer={
        turn.text &&
        turn.phase !== 'streaming' && (
          <MessageActions visibility={presentation === 'studio' ? 'always' : 'hover'}>
            <MessageCopyButton text={turn.text} />
            {presentation === 'factory' && <MessageTimestamp value="2026-09-17T12:24:00Z" />}
          </MessageActions>
        )
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        {turn.review && (
          <>
            <ReasoningPartRenderer
              part={{
                type: 'reasoning',
                reasoning:
                  'I’ll compare the existing composer with the notes, check the keyboard behavior, and propose a small change.',
              }}
            />
            <ToolCallGroup
              steps={reviewTools}
              leading={
                presentation === 'factory' ? <ToolCallTime at={Date.parse('2026-09-17T12:24:00Z')} /> : undefined
              }
            >
              {reviewTools.map(tool => (
                <ReviewTool presentation={presentation} key={tool.toolName} {...tool} />
              ))}
            </ToolCallGroup>
            <Plan>
              <PlanHeader>
                <PlanLabel />
                <PlanHeaderActions>
                  <PlanCopyButton content={plan} />
                </PlanHeaderActions>
              </PlanHeader>
              <PlanBody>
                <PlanIntro>
                  <PlanTitle>Keep the composer predictable</PlanTitle>
                </PlanIntro>
                <PlanMain>
                  <PlanContent>{plan}</PlanContent>
                </PlanMain>
              </PlanBody>
            </Plan>
            <AskUser
              payload={{
                question: 'What should we prioritize in this review?',
                options: [
                  { label: 'Keyboard access', description: 'Sending, new lines, and focus.' },
                  { label: 'Attachment previews', description: 'Adding, removing, and opening files.' },
                ],
              }}
              result={turn.answer ? { content: turn.answer } : undefined}
              onSubmit={answer =>
                transitionTurn(turn.id, 'question', 'approval', Array.isArray(answer) ? answer.join(', ') : answer)
              }
            />
            {turn.phase !== 'question' && (
              <ConversationApproval
                presentation={presentation}
                phase={turn.phase}
                onApprove={approveEdit}
                onDecline={declineEdit}
              />
            )}
          </>
        )}
        {showSettledCommand && (
          <ReviewTool
            presentation={presentation}
            {...reviewCommand}
            output={turn.phase === 'complete' ? '6 tests passed.' : undefined}
          />
        )}
        {turn.phase === 'streaming' && <ReviewTool presentation={presentation} {...reviewCommand} status="running" />}
        {turn.phase === 'tool-error' && (
          <>
            <ReviewTool
              presentation={presentation}
              {...reviewCommand}
              status="error"
              output="Keyboard test failed: expected focus to return to the composer."
              defaultOpen
            />
            <MessageText
              text="The keyboard check failed. I’ll keep the changes available while we investigate."
              metadata={{ status: 'error' }}
            />
            <div>
              <Button onClick={() => transitionTurn(turn.id, 'tool-error', 'streaming')}>Retry tool</Button>
            </div>
          </>
        )}
        {turn.phase === 'error' && (
          <>
            <MessageText
              text="The connection was interrupted before the reply arrived. Your message and attachments are still here."
              metadata={{ status: 'error' }}
            />
            <div>
              <Button onClick={() => transitionTurn(turn.id, 'error', 'streaming')}>Retry response</Button>
            </div>
          </>
        )}
        {turn.phase === 'declined' && (
          <MessageText
            text="The edit was declined. No changes were applied. You can send revised instructions below."
            metadata={{ status: 'warning' }}
          />
        )}
        {shownText && (
          <MessageText text={shownText} metadata={undefined} streaming={turn.phase === 'streaming' || isRevealing} />
        )}
        {turn.phase === 'complete' && turn.review && <ConversationNotification presentation={presentation} />}
      </div>
    </Message>
  );
}
