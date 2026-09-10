import { Check, X } from 'lucide-react';
import { Button } from '../../../ds/components/Button';
import { Txt } from '../../../ds/components/Txt';
import { Icon } from '../../../ds/icons/Icon';

export interface ToolApprovalControlsProps {
  isRunning: boolean;
  status?: 'approved' | 'declined';
  onApprove?: () => void;
  onDecline?: () => void;
}

export const ToolApprovalControls = ({ isRunning, status, onApprove, onDecline }: ToolApprovalControlsProps) => (
  <div>
    <Txt as="p" variant="ui-xs" className="text-icon3 pb-1 select-none">
      Approval required
    </Txt>
    <div className="flex items-center gap-2">
      {onApprove && (
        <Button
          onClick={() => onApprove()}
          disabled={isRunning || !!status}
          className={status === 'approved' ? 'text-accent1!' : ''}
        >
          <Icon>
            <Check />
          </Icon>
          Approve
        </Button>
      )}
      {onDecline && (
        <Button
          onClick={() => onDecline()}
          disabled={isRunning || !!status}
          className={status === 'declined' ? 'text-accent2!' : ''}
        >
          <Icon>
            <X />
          </Icon>
          Decline
        </Button>
      )}
    </div>
  </div>
);
