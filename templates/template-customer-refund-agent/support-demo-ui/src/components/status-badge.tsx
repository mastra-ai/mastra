import { Badge } from '@/components/ui/badge';
import type { CaseStatus } from '@/lib/types';

const STATUS_VARIANTS: Record<CaseStatus, React.ComponentProps<typeof Badge>['variant']> = {
  new: 'outline',
  processing: 'secondary',
  waiting_approval: 'secondary',
  resolved: 'default',
  escalated: 'destructive',
  failed: 'outline',
};

const STATUS_LABELS: Record<CaseStatus, string> = {
  new: 'New',
  processing: 'Processing',
  waiting_approval: 'Waiting on approval',
  resolved: 'Resolved',
  escalated: 'Escalated',
  failed: 'Failed',
};

export function StatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const URGENCY_VARIANTS: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  low: 'outline',
  normal: 'secondary',
  high: 'secondary',
  critical: 'destructive',
};

export function UrgencyBadge({ urgency, className }: { urgency: string; className?: string }) {
  return (
    <Badge variant={URGENCY_VARIANTS[urgency] ?? 'outline'} className={className}>
      {urgency}
    </Badge>
  );
}
