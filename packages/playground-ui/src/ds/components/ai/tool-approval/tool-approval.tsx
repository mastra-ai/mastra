import { Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

export interface ToolApprovalActionsProps {
  onApprove: () => void;
  onDecline: () => void;
  disabled?: boolean;
  status?: 'approved' | 'declined';
  toolName?: string;
  autoFocus?: boolean;
}

export function ToolApprovalActions({
  onApprove,
  onDecline,
  disabled = false,
  status,
  toolName,
  autoFocus = false,
}: ToolApprovalActionsProps) {
  const actionsDisabled = disabled || status !== undefined;
  const approveLabel = status === 'approved' ? 'Approved' : 'Approve';
  const declineLabel = status === 'declined' ? 'Declined' : 'Decline';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={status ? 'default' : 'primary'}
        size="sm"
        icon={<Check />}
        aria-label={toolName ? `${approveLabel} ${toolName}` : undefined}
        autoFocus={autoFocus}
        disabled={actionsDisabled}
        className={status === 'approved' ? 'text-success-indicator! [&_svg]:text-success-indicator!' : undefined}
        onClick={onApprove}
      >
        {approveLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        icon={<X />}
        aria-label={toolName ? `${declineLabel} ${toolName}` : undefined}
        disabled={actionsDisabled}
        className={
          status === 'declined' ? 'text-destructive-foreground! [&_svg]:text-destructive-foreground!' : undefined
        }
        onClick={onDecline}
      >
        {declineLabel}
      </Button>
    </div>
  );
}

export interface ToolApprovalProps extends ToolApprovalActionsProps {
  toolName: string;
  children?: ReactNode;
}

const railColor = {
  approved: 'border-l-success-indicator',
  declined: 'border-l-destructive-indicator',
  pending: 'border-l-warning-indicator',
};

export function ToolApproval({ toolName, children, ...actions }: ToolApprovalProps) {
  return (
    <div
      className={cn(
        'my-2 min-w-0 rounded-lg border border-l-4 border-border bg-fill px-4 py-3',
        railColor[actions.status ?? 'pending'],
      )}
      role="group"
      aria-label={`Tool approval for ${toolName}`}
    >
      <div className="mb-1.5 text-subheading text-foreground">
        Approve <code className="rounded bg-fill-hover px-1.5 py-px font-mono text-caption break-all">{toolName}</code>?
      </div>
      {children}
      <div className="mt-2">
        <ToolApprovalActions toolName={toolName} {...actions} />
      </div>
    </div>
  );
}
