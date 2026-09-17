import type { Phase } from '../data';
import { editArgs } from '../data';
import { ReviewTool } from './tool';
import { ToolApproval } from '@/ds/components/ai/tool-approval';
import { ToolCallArguments } from '@/ds/components/ai/tool-call';

interface ConversationApprovalProps {
  phase: Phase;
  onApprove: () => void;
  onDecline: () => void;
}

export function ConversationApproval({ phase, onApprove, onDecline }: ConversationApprovalProps) {
  if (phase === 'approval') {
    return (
      <ToolApproval toolName="edit_file" onApprove={onApprove} onDecline={onDecline}>
        <ToolCallArguments toolName="edit_file" args={editArgs} />
      </ToolApproval>
    );
  }

  return <ReviewTool toolName="edit_file" args={editArgs} />;
}
