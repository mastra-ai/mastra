import { Txt } from '@/ds/components/Txt';
import { SyntaxHighlighter } from '../../ui/syntax-highlighter';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { Check, X } from 'lucide-react';

export interface ToolApprovalProps {
  toolCallId: string;
  toolName: string;
  args: any;
  onApprove: () => void;
  onDecline: () => void;
}

export const ToolApproval = ({ toolName, args, onApprove, onDecline }: ToolApprovalProps) => {
  let argSlot = null;

  try {
    const formattedArgs = typeof args === 'object' ? args : JSON.parse(args);
    argSlot = <SyntaxHighlighter data={formattedArgs} />;
  } catch {
    argSlot = <pre className="whitespace-pre-wrap">{args as string}</pre>;
  }
  return (
    <div className="">
      <Txt variant="header-md">Tool approval required for: {toolName}</Txt>
      {argSlot}

      <div className="flex gap-2 items-center">
        <Button onClick={onApprove}>
          <Icon>
            <Check />
          </Icon>
          Approve
        </Button>
        <Button onClick={onDecline}>
          <Icon>
            <X />
          </Icon>
          Decline
        </Button>
      </div>
    </div>
  );
};
