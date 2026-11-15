import type { LucideIcon } from 'lucide-react';

import type { WorkspaceChangeStatus } from '../../../../../api/types';
import { IconArrowRightSquare } from '@mastra/playground-ui/icons/central/IconArrowRightSquare';
import { IconChanges } from '@mastra/playground-ui/icons/central/IconChanges';
import { IconExclamationTriangle } from '@mastra/playground-ui/icons/central/IconExclamationTriangle';
import { IconSquareMinus } from '@mastra/playground-ui/icons/central/IconSquareMinus';
import { IconSquarePlus } from '@mastra/playground-ui/icons/central/IconSquarePlus';

export const CHANGE_STATUSES: Record<
  WorkspaceChangeStatus,
  { Icon: LucideIcon; label: string; letter: string; className: string }
> = {
  modified: { Icon: IconChanges, label: 'Modified', letter: 'M', className: 'text-warning-indicator' },
  added: { Icon: IconSquarePlus, label: 'Added', letter: 'A', className: 'text-success-indicator' },
  untracked: { Icon: IconSquarePlus, label: 'Untracked', letter: 'U', className: 'text-success-indicator' },
  copied: { Icon: IconSquarePlus, label: 'Copied', letter: 'C', className: 'text-success-indicator' },
  deleted: { Icon: IconSquareMinus, label: 'Deleted', letter: 'D', className: 'text-destructive-indicator' },
  renamed: { Icon: IconArrowRightSquare, label: 'Renamed', letter: 'R', className: 'text-info-indicator' },
  conflicted: {
    Icon: IconExclamationTriangle,
    label: 'Conflict',
    letter: '!',
    className: 'text-destructive-indicator',
  },
};
