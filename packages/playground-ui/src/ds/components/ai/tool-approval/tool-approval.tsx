import { Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={status ? 'default' : 'primary'}
        size="sm"
        icon={<Check />}
        aria-label={toolName ? `Approve ${toolName}` : undefined}
        autoFocus={autoFocus}
        disabled={actionsDisabled}
        className={status === 'approved' ? 'text-accent1!' : undefined}
        onClick={onApprove}
      >
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        icon={<X />}
        aria-label={toolName ? `Decline ${toolName}` : undefined}
        disabled={actionsDisabled}
        className={status === 'declined' ? 'text-accent2!' : undefined}
        onClick={onDecline}
      >
        Decline
      </Button>
    </div>
  );
}

export interface ToolApprovalProps extends ToolApprovalActionsProps {
  toolName: string;
  children?: ReactNode;
}

export function ToolApproval({ toolName, children, ...actions }: ToolApprovalProps) {
  return (
    <div
      className="border-border border-l-warning1 bg-fill my-2 min-w-0 rounded-lg border border-l-4 px-4 py-3"
      role="group"
      aria-label={`Tool approval for ${toolName}`}
    >
      <div className="text-icon6 text-subheading mb-1.5">
        Approve <code className="bg-surface5 text-caption rounded px-1.5 py-px font-mono break-all">{toolName}</code>?
      </div>
      {children}
      <div className="mt-2">
        <ToolApprovalActions toolName={toolName} {...actions} />
      </div>
    </div>
  );
}
