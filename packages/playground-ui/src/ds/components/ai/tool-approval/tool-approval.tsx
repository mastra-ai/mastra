import { Check, ShieldCheck, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Activity, ActivityContent, ActivityHeader, ActivityIcon, ActivityTrigger } from '../activity';
import { presentTool, ToolCallArguments } from '../tool-call';
import { Badge } from '@/ds/components/Badge';
import type { BadgeVariant } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

interface ApprovalDecisionProps {
  onApprove: () => void;
  onDecline: () => void;
  disabled?: boolean;
  status?: 'approved' | 'declined';
  toolName?: string;
  autoFocus?: boolean;
}

const approvalStates = {
  pending: { label: 'Approval required', variant: 'warning', icon: ShieldCheck },
  approved: { label: 'Approved', variant: 'success', icon: Check },
  declined: { label: 'Declined', variant: 'neutral', icon: X },
} satisfies Record<string, { label: string; variant: BadgeVariant; icon: typeof Check }>;

function ApprovalStatus({ status }: Pick<ToolApprovalProps, 'status'>) {
  const { label, variant, icon: StatusIcon } = approvalStates[status ?? 'pending'];
  return (
    <span role="status" className="inline-flex shrink-0">
      <Badge variant={variant} emphasis="subtle" size="sm" icon={<StatusIcon aria-hidden />}>
        {label}
      </Badge>
    </span>
  );
}

function ApprovalActions({
  onApprove,
  onDecline,
  disabled = false,
  status,
  toolName,
  autoFocus = false,
}: ApprovalDecisionProps) {
  if (status) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="primary"
        size="sm"
        icon={<Check aria-hidden />}
        aria-label={toolName ? `Approve ${toolName}` : undefined}
        autoFocus={autoFocus}
        disabled={disabled}
        onClick={onApprove}
      >
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        icon={<X aria-hidden />}
        aria-label={toolName ? `Decline ${toolName}` : undefined}
        disabled={disabled}
        onClick={onDecline}
      >
        Decline
      </Button>
    </div>
  );
}

export interface ToolApprovalProps extends ApprovalDecisionProps {
  toolName: string;
  /** Inline omits the activity frame when the tool already has its own details. */
  variant?: 'default' | 'inline';
  /** Full arguments, rendered with the same tool details used by Studio. */
  args?: unknown;
  /** Inline only: set false when ToolApproval.Status is already in the tool header. */
  showStatus?: boolean;
  /** Custom details replace the default argument renderer. */
  children?: ReactNode;
}

export function ToolApproval({
  toolName,
  variant = 'default',
  args,
  children,
  showStatus = true,
  ...actions
}: ToolApprovalProps) {
  const content = (
    <>
      {children ?? <ToolCallArguments toolName={toolName} args={args} showFullContent />}
      <ApprovalActions toolName={toolName} {...actions} />
    </>
  );

  if (variant === 'inline') {
    return (
      <div className="flex min-w-0 flex-col gap-2" role="group" aria-label={`Tool approval for ${toolName}`}>
        {showStatus && <ApprovalStatus status={actions.status} />}
        {content}
      </div>
    );
  }

  const { icon: ToolIcon } = presentTool(toolName, args);

  return (
    <Activity open foldable={false} className="my-2" aria-label={`Tool approval for ${toolName}`}>
      <ActivityTrigger>
        <ActivityHeader className="flex-wrap">
          <ActivityIcon>
            <ToolIcon aria-hidden />
          </ActivityIcon>
          <Txt as="span" variant="caption" tone="muted" font="mono" className="min-w-0 break-all">
            {toolName}
          </Txt>
          <ApprovalStatus status={actions.status} />
        </ActivityHeader>
      </ActivityTrigger>
      <ActivityContent>{content}</ActivityContent>
    </Activity>
  );
}

/** Shared approval UI; Status is the header slot for an existing tool activity. */
ToolApproval.Status = ApprovalStatus;

/** @deprecated Use ToolApprovalProps and ToolApproval with variant="inline". */
export type ToolApprovalActionsProps = ApprovalDecisionProps;

/** @deprecated Use ToolApproval with variant="inline". Kept for existing consumers. */
export function ToolApprovalActions(props: ToolApprovalActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ApprovalStatus status={props.status} />
      <ApprovalActions {...props} />
    </div>
  );
}
