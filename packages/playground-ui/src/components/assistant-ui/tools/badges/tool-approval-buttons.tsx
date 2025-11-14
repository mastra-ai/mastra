import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { useToolCall } from '@/services/tool-call-provider';
import { MastraUIMessage } from '@mastra/react';
import { Check, X } from 'lucide-react';

export interface ToolApprovalButtonsProps {
  toolCallId: string;
  toolCalled: boolean;
  toolApprovalMetadata:
    | {
        toolCallId: string;
        toolName: string;
        args: Record<string, any>;
      }
    | undefined;
}

export const ToolApprovalButtons = ({ toolCalled, toolCallId, toolApprovalMetadata }: ToolApprovalButtonsProps) => {
  const { approveToolcall, declineToolcall, isRunning, toolCallApprovals } = useToolCall();

  const handleApprove = () => {
    approveToolcall(toolCallId);
  };

  const handleDecline = () => {
    declineToolcall(toolCallId);
  };

  const toolCallApprovalStatus = toolCallApprovals?.[toolCallId]?.status;

  if (toolApprovalMetadata && !toolCalled) {
    return (
      <div>
        <p className="font-medium pb-2">Approval required</p>
        <div className="flex gap-2 items-center">
          <Button
            onClick={handleApprove}
            disabled={isRunning || !!toolCallApprovalStatus}
            className={toolCallApprovalStatus === 'approved' ? '!text-accent1' : ''}
          >
            <Icon>
              <Check />
            </Icon>
            Approve
          </Button>
          <Button
            onClick={handleDecline}
            disabled={isRunning || !!toolCallApprovalStatus}
            className={toolCallApprovalStatus === 'declined' ? '!text-accent2' : ''}
          >
            <Icon>
              <X />
            </Icon>
            Decline
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
