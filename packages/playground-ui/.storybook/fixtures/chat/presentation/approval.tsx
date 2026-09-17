import type { ChatPresentation, Phase } from '../data';
import { editArgs } from '../data';
import { ReviewTool } from './tool';
import { ToolApproval, ToolApprovalActions } from '@/ds/components/ai/tool-approval';
import { ToolCallArguments } from '@/ds/components/ai/tool-call';

interface ConversationApprovalProps {
  presentation: ChatPresentation;
  phase: Phase;
  onApprove: () => void;
  onDecline: () => void;
}

export function ConversationApproval({ presentation, phase, onApprove, onDecline }: ConversationApprovalProps) {
  if (presentation === 'factory' && phase === 'approval') {
    return (
      <ToolApproval toolName="edit_file" onApprove={onApprove} onDecline={onDecline}>
        <ToolCallArguments toolName="edit_file" args={editArgs} />
      </ToolApproval>
    );
  }

  return (
    <ReviewTool presentation={presentation} toolName="edit_file" args={editArgs} defaultOpen={phase === 'approval'}>
      {phase === 'approval' && <ToolApprovalActions toolName="edit_file" onApprove={onApprove} onDecline={onDecline} />}
    </ReviewTool>
  );
}
