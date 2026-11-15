import { SquareArrowRight, SquareDot, SquareMinus, SquarePlus, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { WorkspaceChangeStatus } from '../../../../../api/types';

export const CHANGE_STATUSES: Record<
  WorkspaceChangeStatus,
  { Icon: LucideIcon; label: string; letter: string; className: string }
> = {
  modified: { Icon: SquareDot, label: 'Modified', letter: 'M', className: 'text-warning-indicator' },
  added: { Icon: SquarePlus, label: 'Added', letter: 'A', className: 'text-success-indicator' },
  untracked: { Icon: SquarePlus, label: 'Untracked', letter: 'U', className: 'text-success-indicator' },
  copied: { Icon: SquarePlus, label: 'Copied', letter: 'C', className: 'text-success-indicator' },
  deleted: { Icon: SquareMinus, label: 'Deleted', letter: 'D', className: 'text-destructive-indicator' },
  renamed: { Icon: SquareArrowRight, label: 'Renamed', letter: 'R', className: 'text-info-indicator' },
  conflicted: { Icon: TriangleAlert, label: 'Conflict', letter: '!', className: 'text-destructive-indicator' },
};
