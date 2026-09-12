import type { TextPart } from '@mastra/react';
import { editArgs, plan, reviewTools } from './data';
import type { Phase, Turn } from './data';
import { ReviewTool } from './tool';
import { ToolCallProvider } from '@/domains/chat/context/tool-call-context';
import { MessageText } from '@/domains/chat/messages/renderers/message-text';
import { ReasoningPartRenderer } from '@/domains/chat/messages/renderers/reasoning-part-renderer';
import { SignalBadge } from '@/domains/chat/messages/signal-badge';
import { ToolApprovalButtons } from '@/domains/chat/tools/badges/tool-approval-buttons';
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
import { ToolCallGroup } from '@/ds/components/ai/tool-call';
import { Button } from '@/ds/components/Button';
import { CopyButton } from '@/ds/components/CopyButton';

interface ConversationResponseProps {
  turn: Turn;
  transitionTurn: (id: string, from: Phase, to: Phase, answer?: string) => void;
}

export function ConversationResponse({ turn, transitionTurn }: ConversationResponseProps) {
  const writtenParts = [{ type: 'text', text: turn.text }] satisfies TextPart[];
  const shownParts = useRevealedParts(writtenParts, turn.phase === 'streaming');
  const shownPart = shownParts[0];
  const shownText = shownPart?.type === 'text' ? shownPart.text : '';
  const isRevealing = shownParts !== writtenParts;
  const approveEdit = () => transitionTurn(turn.id, 'approval', 'streaming');
  const declineEdit = () => transitionTurn(turn.id, 'approval', 'declined');
  return (
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
          <ToolCallGroup steps={reviewTools}>
            {reviewTools.map(tool => (
              <ReviewTool key={tool.toolName} {...tool} />
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
            <ReviewTool toolName="edit_file" args={editArgs} defaultOpen={turn.phase === 'approval'}>
              {turn.phase === 'approval' && (
                <ToolCallProvider
                  approveToolcall={approveEdit}
                  declineToolcall={declineEdit}
                  approveToolcallGenerate={approveEdit}
                  declineToolcallGenerate={declineEdit}
                  approveNetworkToolcall={approveEdit}
                  declineNetworkToolcall={declineEdit}
                  isRunning={false}
                  toolCallApprovals={{}}
                  networkToolCallApprovals={{}}
                >
                  <ToolApprovalButtons
                    toolCallId="composer-edit"
                    toolName="edit_file"
                    toolCalled={false}
                    isNetwork={false}
                    toolApprovalMetadata={{ toolCallId: 'composer-edit', toolName: 'edit_file', args: editArgs }}
                  />
                </ToolCallProvider>
              )}
            </ReviewTool>
          )}
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
      {turn.phase === 'complete' && turn.review && (
        <SignalBadge
          signal={{
            type: 'notification',
            attributes: { source: 'review', kind: 'success', status: 'completed' },
            contents: 'Composer review complete',
          }}
        />
      )}
      {turn.text && turn.phase !== 'streaming' && (
        <div>
          <CopyButton content={turn.text} />
        </div>
      )}
    </div>
  );
}
