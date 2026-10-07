import { Check, ShieldCheck, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Activity, ActivityContent, ActivityHeader, ActivityIcon, ActivityTrigger } from '../activity';
import { presentTool, ToolCallArguments } from '../tool-call';
import { Badge } from '@/ds/components/Badge';
import type { BadgeVariant } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';

type ToolApprovalDecision = 'approved' | 'declined';

const approvalStates = {
  pending: { label: 'Approval required', variant: 'warning', icon: ShieldCheck },
  approved: { label: 'Approved', variant: 'success', icon: Check },
  declined: { label: 'Declined', variant: 'neutral', icon: X },
} satisfies Record<'pending' | ToolApprovalDecision, { label: string; variant: BadgeVariant; icon: LucideIcon }>;

export interface ToolApprovalStatusProps {
  status?: ToolApprovalDecision;
}

export function ToolApprovalStatus({ status }: ToolApprovalStatusProps) {
  const { label, variant, icon: StatusIcon } = approvalStates[status ?? 'pending'];
  return (
    <span role="status" className="inline-flex shrink-0">
      <Badge variant={variant} emphasis="subtle" size="sm" icon={<StatusIcon aria-hidden />}>
        {label}
      </Badge>
    </span>
  );
}

export interface ToolApprovalActionsProps {
  onApprove: () => void;
  onDecline: () => void;
  disabled?: boolean;
  toolName?: string;
  autoFocus?: boolean;
}

export function ToolApprovalActions({
  onApprove,
  onDecline,
  disabled = false,
  toolName,
  autoFocus = false,
}: ToolApprovalActionsProps) {
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

export interface ToolApprovalProps extends ToolApprovalActionsProps, ToolApprovalStatusProps {
  toolName: string;
  args?: unknown;
  /** Custom details replace the default argument renderer. */
  children?: ReactNode;
}

export function ToolApproval({ toolName, args, status, children, ...actions }: ToolApprovalProps) {
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
          <ToolApprovalStatus status={status} />
        </ActivityHeader>
      </ActivityTrigger>
      <ActivityContent>
        {children ?? <ToolCallArguments toolName={toolName} args={args} showFullContent />}
        {!status && <ToolApprovalActions toolName={toolName} {...actions} />}
      </ActivityContent>
    </Activity>
  );
}
