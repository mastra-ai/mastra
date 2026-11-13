import { SquareDot } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { WorkspaceChangeStatus } from '../../../../../api/types';
import { IconArrowRightSquare } from '@mastra/playground-ui/icons/central/IconArrowRightSquare';
import { IconExclamationTriangle } from '@mastra/playground-ui/icons/central/IconExclamationTriangle';
import { IconSquarePlus } from '@mastra/playground-ui/icons/central/IconSquarePlus';
import { IconSquareMinus } from '@mastra/playground-ui/icons/central/IconSquareMinus';

const STATUS_ICONS: Record<WorkspaceChangeStatus, { Icon: LucideIcon; label: string; className: string }> = {
  modified: { Icon: SquareDot, label: 'Modified', className: 'text-warning-indicator' },
  added: { Icon: IconSquarePlus, label: 'Added', className: 'text-success-indicator' },
  untracked: { Icon: IconSquarePlus, label: 'Untracked', className: 'text-success-indicator' },
  copied: { Icon: IconSquarePlus, label: 'Copied', className: 'text-success-indicator' },
  deleted: { Icon: IconSquareMinus, label: 'Deleted', className: 'text-destructive-indicator' },
  renamed: { Icon: IconArrowRightSquare, label: 'Renamed', className: 'text-info-indicator' },
  conflicted: { Icon: IconExclamationTriangle, label: 'Conflict', className: 'text-destructive-indicator' },
};

export function ChangeStatusIcon({ status }: { status: WorkspaceChangeStatus }) {
  const { Icon, label, className } = STATUS_ICONS[status];
  return <Icon role="img" aria-label={label} className={className} />;
}
