import { SquareArrowRight, SquareDot, SquareMinus, SquarePlus, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { WorkspaceChangeStatus } from '../../../../../api/types';

const STATUS_ICONS: Record<WorkspaceChangeStatus, { Icon: LucideIcon; label: string; className: string }> = {
  modified: { Icon: SquareDot, label: 'Modified', className: 'text-warning-indicator' },
  added: { Icon: SquarePlus, label: 'Added', className: 'text-success-indicator' },
  untracked: { Icon: SquarePlus, label: 'Untracked', className: 'text-success-indicator' },
  copied: { Icon: SquarePlus, label: 'Copied', className: 'text-success-indicator' },
  deleted: { Icon: SquareMinus, label: 'Deleted', className: 'text-destructive-indicator' },
  renamed: { Icon: SquareArrowRight, label: 'Renamed', className: 'text-info-indicator' },
  conflicted: { Icon: TriangleAlert, label: 'Conflict', className: 'text-destructive-indicator' },
};

export function ChangeStatusIcon({ status }: { status: WorkspaceChangeStatus }) {
  const { Icon, label, className } = STATUS_ICONS[status];
  return <Icon role="img" aria-label={label} className={className} />;
}
